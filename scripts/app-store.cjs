#!/usr/bin/env node
/*
 * App Store Connect snapshot and listing updates for Departure: Fitness Quest.
 *
 * Run by .github/workflows/app-store-daily.yml. No npm dependencies (Node 22: fetch + crypto).
 *
 * Env:
 *   ASC_KEY_P8      full .p8 text (secret)
 *   ASC_KEY_ID      key id (secret)
 *   ASC_ISSUER_ID   issuer id
 *   ASC_APP_ID      App Store app id (default 6761634387)
 *
 * Reads (optional): ops/requests/app-store/listing.json
 *   { "locale": "en-US", "subtitle", "keywords", "promotionalText", "description", "whatsNew" }
 *   Only fields present are changed. The file is deleted after it is processed.
 * Reads (optional): ops/requests/app-store/release.json
 *   { "version", "build", "whatsNew", "keywords", "promotionalText", "description", "subtitle",
 *     "privacyPolicyUrl", "releaseType", "submitForReview", "locale" }
 *   Finds or creates the version, waits for the build, attaches it, sets the listing text,
 *   answers export compliance and, when asked, submits for review. Result in last-release.json.
 * Writes: ops/reports/app-store/latest.json, ops/reports/app-store/YYYY-MM-DD.json,
 *         ops/reports/app-store/last-apply.json (only when a request was processed).
 *
 * Never touches pricing, availability or in-app purchases.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REQUEST_FILE = path.join(ROOT, 'ops/requests/app-store/listing.json');
const RELEASE_FILE = path.join(ROOT, 'ops/requests/app-store/release.json');
const DIAGNOSE_FILE = path.join(ROOT, 'ops/requests/app-store/diagnose.json');
const COMPLIANCE_FILE = path.join(ROOT, 'ops/requests/app-store/compliance.json');
const REPORT_DIR = path.join(ROOT, 'ops/reports/app-store');
const API = 'https://api.appstoreconnect.apple.com';
const APP_ID = process.env.ASC_APP_ID || '6761634387';

// Version states where the version and its localizations can still be edited.
const EDITABLE_VERSION_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);
// States that are already released (promotional text can still be changed on these).
const LIVE_VERSION_STATES = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']);
// App info states that cannot be edited (subtitle lives on app info).
const LOCKED_APP_INFO_STATES = new Set([
  'READY_FOR_DISTRIBUTION',
  'READY_FOR_SALE',
  'IN_REVIEW',
  'WAITING_FOR_REVIEW',
  'PENDING_RELEASE',
  'ACCEPTED',
  'REPLACED_WITH_NEW_INFO',
]);

const VERSION_FIELDS = ['description', 'keywords', 'promotionalText', 'whatsNew'];
const APP_INFO_FIELDS = ['subtitle'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeToken() {
  const { ASC_KEY_P8, ASC_KEY_ID, ASC_ISSUER_ID } = process.env;
  if (!ASC_KEY_P8 || !ASC_KEY_ID) throw new Error('ASC_KEY_P8 or ASC_KEY_ID is not set');
  if (!ASC_ISSUER_ID || ASC_ISSUER_ID.startsWith('REPLACE')) throw new Error('ASC_ISSUER_ID is not set');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(ASC_KEY_P8.replace(/\\n/g, '\n'));
  const sig = crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(sig)}`;
}

let TOKEN = null;
let TOKEN_AT = 0;

async function asc(method, urlPath, body) {
  // Tokens live 20 minutes; the release request can poll for 30, so renew after 15.
  if (TOKEN && Date.now() - TOKEN_AT > 15 * 60 * 1000) {
    TOKEN = makeToken();
    TOKEN_AT = Date.now();
  }
  const res = await fetch(urlPath.startsWith('http') ? urlPath : API + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* keep text */ }
  if (!res.ok) {
    const detail = json && json.errors
      ? json.errors.map((e) => `${e.code || ''} ${e.title || ''}: ${e.detail || ''}`.trim()).join('; ')
      : text.slice(0, 500);
    const err = new Error(`${method} ${urlPath} -> ${res.status} ${detail}`);
    err.status = res.status;
    // Full error body, so reports keep errors[].meta.associatedErrors and source pointers.
    err.apiErrors = json && json.errors ? json.errors : null;
    if (!err.apiErrors && text) err.body = text.slice(0, 4000);
    throw err;
  }
  return json;
}

// Error text plus Apple's full error objects (including meta.associatedErrors).
function errorRecord(base, e) {
  const out = { ...base, error: e && e.message ? e.message : String(e) };
  if (e && e.apiErrors) out.apiErrors = e.apiErrors;
  if (e && e.body) out.body = e.body;
  if (e && e.status) out.httpStatus = e.status;
  return out;
}

// Runs a section and records errors instead of failing the whole snapshot.
async function section(errors, name, fn) {
  try {
    return await fn();
  } catch (e) {
    errors.push(errorRecord({ section: name }, e));
    return null;
  }
}

function versionState(v) {
  return v.attributes.appVersionState || v.attributes.appStoreState;
}

function appInfoState(i) {
  return i.attributes.state || i.attributes.appStoreState;
}

async function getVersions() {
  const json = await asc(
    'GET',
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10` +
      '&fields[appStoreVersions]=versionString,appStoreState,appVersionState,releaseType,createdDate,earliestReleaseDate',
  );
  return json.data.map((v) => ({
    id: v.id,
    versionString: v.attributes.versionString,
    state: versionState(v),
    appStoreState: v.attributes.appStoreState,
    appVersionState: v.attributes.appVersionState,
    releaseType: v.attributes.releaseType,
    createdDate: v.attributes.createdDate,
    editable: EDITABLE_VERSION_STATES.has(versionState(v)),
    live: LIVE_VERSION_STATES.has(versionState(v)),
  }));
}

async function getVersionLocalizations(versionId) {
  const json = await asc('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`);
  return json.data.map((l) => ({ id: l.id, ...l.attributes }));
}

async function getAppInfos() {
  const json = await asc('GET', `/v1/apps/${APP_ID}/appInfos?limit=10`);
  return json.data.map((i) => ({
    id: i.id,
    state: appInfoState(i),
    appStoreState: i.attributes.appStoreState,
    editable: !LOCKED_APP_INFO_STATES.has(appInfoState(i)),
  }));
}

async function getAppInfoLocalizations(appInfoId) {
  const json = await asc('GET', `/v1/appInfos/${appInfoId}/appInfoLocalizations?limit=50`);
  return json.data.map((l) => ({ id: l.id, ...l.attributes }));
}

// Public iTunes lookup gives the overall star rating; ASC API has no ratings summary endpoint.
async function getRatingsSummary() {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_ID}&country=us`);
  if (!res.ok) throw new Error(`iTunes lookup -> ${res.status}`);
  const json = await res.json();
  const r = json.results && json.results[0];
  if (!r) return { available: false, note: 'iTunes lookup returned no result (country us)' };
  return {
    available: true,
    source: 'itunes.apple.com/lookup (country us)',
    averageUserRating: r.averageUserRating ?? null,
    userRatingCount: r.userRatingCount ?? null,
    averageUserRatingForCurrentVersion: r.averageUserRatingForCurrentVersion ?? null,
    userRatingCountForCurrentVersion: r.userRatingCountForCurrentVersion ?? null,
    storeVersion: r.version ?? null,
    currentVersionReleaseDate: r.currentVersionReleaseDate ?? null,
  };
}

async function getReviews() {
  const json = await asc(
    'GET',
    `/v1/apps/${APP_ID}/customerReviews?sort=-createdDate&limit=50&include=response`,
  );
  const responses = new Map(
    (json.included || [])
      .filter((x) => x.type === 'customerReviewResponses')
      .map((x) => [x.id, x.attributes]),
  );
  return json.data.map((r) => {
    const respId = r.relationships && r.relationships.response && r.relationships.response.data
      ? r.relationships.response.data.id
      : null;
    return {
      id: r.id,
      rating: r.attributes.rating,
      title: r.attributes.title,
      body: r.attributes.body,
      reviewerNickname: r.attributes.reviewerNickname,
      createdDate: r.attributes.createdDate,
      territory: r.attributes.territory,
      response: respId && responses.has(respId) ? responses.get(respId) : null,
    };
  });
}

function pickFields(request, fields) {
  const out = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(request, f) && request[f] !== undefined && request[f] !== null) {
      if (typeof request[f] !== 'string') throw new Error(`Field ${f} must be a string`);
      out[f] = request[f];
    }
  }
  return out;
}

async function applyRequest(request, versions, appInfos) {
  const locale = request.locale || 'en-US';
  const result = {
    requestedAt: request.requestedAt || null,
    appliedAt: new Date().toISOString(),
    locale,
    request,
    changes: [],
    skipped: [],
    errors: [],
  };

  const versionChanges = pickFields(request, VERSION_FIELDS);
  const appInfoChanges = pickFields(request, APP_INFO_FIELDS);
  const unknown = Object.keys(request).filter(
    (k) => ![...VERSION_FIELDS, ...APP_INFO_FIELDS, 'locale', 'requestedAt', 'note'].includes(k),
  );
  if (unknown.length) result.skipped.push({ fields: unknown, reason: 'unknown fields, ignored' });

  // Version localization (description, keywords, promotional text, what's new).
  if (Object.keys(versionChanges).length) {
    const editable = versions.find((v) => v.editable);
    let target = editable;
    let fields = versionChanges;
    if (!editable) {
      // Promotional text can be changed on the live version without a new submission.
      const live = versions.find((v) => v.live);
      const promo = pickFields(request, ['promotionalText']);
      const rest = Object.keys(versionChanges).filter((k) => k !== 'promotionalText');
      if (rest.length) {
        result.skipped.push({
          fields: rest,
          reason: 'no editable App Store version (state PREPARE_FOR_SUBMISSION or rejected). ' +
            'Create a new version in App Store Connect or push an ios-v* tag first.',
        });
      }
      if (live && Object.keys(promo).length) {
        target = live;
        fields = promo;
      } else {
        target = null;
        if (Object.keys(promo).length) result.skipped.push({ fields: ['promotionalText'], reason: 'no live or editable version' });
      }
    }
    if (target) {
      try {
        const locs = await getVersionLocalizations(target.id);
        const loc = locs.find((l) => l.locale === locale);
        if (!loc) {
          result.skipped.push({ fields: Object.keys(fields), reason: `version ${target.versionString} has no ${locale} localization` });
        } else {
          const before = Object.fromEntries(Object.keys(fields).map((k) => [k, loc[k] ?? null]));
          await asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
            data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: fields },
          });
          result.changes.push({
            target: 'appStoreVersionLocalization',
            version: target.versionString,
            versionState: target.state,
            localizationId: loc.id,
            before,
            after: fields,
          });
        }
      } catch (e) {
        result.errors.push(errorRecord({ target: 'appStoreVersionLocalization', fields: Object.keys(fields) }, e));
      }
    }
  }

  // App info localization (subtitle).
  if (Object.keys(appInfoChanges).length) {
    const info = appInfos.find((i) => i.editable);
    if (!info) {
      result.skipped.push({
        fields: Object.keys(appInfoChanges),
        reason: 'no editable app info. Subtitle can only change together with a new version in preparation.',
      });
    } else {
      try {
        const locs = await getAppInfoLocalizations(info.id);
        const loc = locs.find((l) => l.locale === locale);
        if (!loc) {
          result.skipped.push({ fields: Object.keys(appInfoChanges), reason: `app info has no ${locale} localization` });
        } else {
          const before = Object.fromEntries(Object.keys(appInfoChanges).map((k) => [k, loc[k] ?? null]));
          await asc('PATCH', `/v1/appInfoLocalizations/${loc.id}`, {
            data: { type: 'appInfoLocalizations', id: loc.id, attributes: appInfoChanges },
          });
          result.changes.push({
            target: 'appInfoLocalization',
            appInfoState: info.state,
            localizationId: loc.id,
            before,
            after: appInfoChanges,
          });
        }
      } catch (e) {
        result.errors.push(errorRecord({ target: 'appInfoLocalization', fields: Object.keys(appInfoChanges) }, e));
      }
    }
  }

  result.ok = result.errors.length === 0 && result.skipped.filter((s) => !/unknown fields/.test(s.reason)).length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Release request: ops/requests/app-store/release.json
// ---------------------------------------------------------------------------

// qualia-fitness/app.json sets expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false
// (checked 2026-11-22). Only because of that may the job answer the export compliance
// question with usesNonExemptEncryption=false. If app.json changes, change this too.
const APP_DECLARES_NO_NON_EXEMPT_ENCRYPTION = true;

const RELEASE_TYPES = new Set(['MANUAL', 'AFTER_APPROVAL', 'SCHEDULED']);
const RELEASE_VERSION_FIELDS = ['whatsNew', 'keywords', 'promotionalText', 'description'];
const RELEASE_APP_INFO_FIELDS = ['subtitle', 'privacyPolicyUrl'];
const RELEASE_KNOWN_FIELDS = [
  'version', 'build', 'locale', 'releaseType', 'submitForReview', 'requestedAt', 'note',
  ...RELEASE_VERSION_FIELDS, ...RELEASE_APP_INFO_FIELDS,
];
// Review submission states that still accept items and can be submitted.
const OPEN_SUBMISSION_STATES = new Set(['READY_FOR_REVIEW']);
// Version states that mean it is already with Apple: no edits, no new submission.
const SUBMITTED_VERSION_STATES = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_DEVELOPER_RELEASE',
  'PENDING_APPLE_RELEASE', 'PROCESSING_FOR_DISTRIBUTION', 'ACCEPTED', 'READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']);
const BUILD_WAIT_MS = 30 * 60 * 1000;
const BUILD_POLL_MS = 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findVersion(versionString) {
  const json = await asc(
    'GET',
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${encodeURIComponent(versionString)}` +
      '&limit=5&include=build',
  );
  return json.data[0] || null;
}

async function findBuild(versionString, buildNumber) {
  const json = await asc(
    'GET',
    `/v1/builds?filter[app]=${APP_ID}&filter[version]=${encodeURIComponent(buildNumber)}` +
      `&filter[preReleaseVersion.version]=${encodeURIComponent(versionString)}` +
      '&filter[preReleaseVersion.platform]=IOS&limit=5',
  );
  return json.data[0] || null;
}

async function processRelease(req) {
  const locale = req.locale || 'en-US';
  const out = { startedAt: new Date().toISOString(), request: req, locale, steps: [], ok: false };
  const step = (name, status, details) => {
    const s = { step: name, status, at: new Date().toISOString(), ...details };
    out.steps.push(s);
    console.log(`release ${name}: ${status}${details && details.error ? ' ' + details.error : ''}`);
    return s;
  };
  const fail = (name, e, extra) => {
    const r = errorRecord({}, e);
    delete r.error;
    return step(name, 'error', { error: e.message || String(e), ...r, ...extra });
  };

  const version = typeof req.version === 'string' ? req.version.trim() : '';
  const buildNumber = req.build === undefined || req.build === null ? '' : String(req.build).trim();
  if (!/^\d+(\.\d+){0,2}$/.test(version)) {
    step('validate', 'error', { error: 'version must be a string like "1.0.4"' });
    return out;
  }
  if (req.releaseType !== undefined && !RELEASE_TYPES.has(req.releaseType)) {
    step('validate', 'error', { error: `releaseType must be one of ${[...RELEASE_TYPES].join(', ')}` });
    return out;
  }
  let versionFields;
  let appInfoFields;
  try {
    versionFields = pickFields(req, RELEASE_VERSION_FIELDS);
    appInfoFields = pickFields(req, RELEASE_APP_INFO_FIELDS);
  } catch (e) {
    fail('validate', e);
    return out;
  }
  const unknown = Object.keys(req).filter((k) => !RELEASE_KNOWN_FIELDS.includes(k));
  step('validate', 'ok', unknown.length ? { ignoredFields: unknown } : {});

  // 1. Find or create the App Store version.
  let ver;
  try {
    ver = await findVersion(version);
    if (ver) {
      step('version', 'found', { id: ver.id, state: versionState(ver), releaseType: ver.attributes.releaseType });
    } else {
      const created = await asc('POST', '/v1/appStoreVersions', {
        data: {
          type: 'appStoreVersions',
          attributes: { platform: 'IOS', versionString: version },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      });
      ver = created.data;
      step('version', 'created', { id: ver.id, state: versionState(ver) });
    }
  } catch (e) {
    fail('version', e);
    return out;
  }
  const verState = versionState(ver);
  if (SUBMITTED_VERSION_STATES.has(verState)) {
    step('stop', 'skipped', { reason: `version ${version} is already ${verState}; nothing changed` });
    out.ok = true;
    out.finalVersionState = verState;
    return out;
  }
  // READY_FOR_REVIEW: added to a review submission that was not sent yet; still editable.
  if (!EDITABLE_VERSION_STATES.has(verState) && verState !== 'READY_FOR_REVIEW') {
    step('stop', 'error', { error: `version ${version} is in state ${verState}, which cannot be edited` });
    return out;
  }

  // 2. Wait for the build to be processed, then attach it.
  let build = null;
  if (!buildNumber) {
    step('build', 'skipped', { reason: 'no build number in the request' });
  } else {
    const deadline = Date.now() + BUILD_WAIT_MS;
    let lastState = null;
    let polls = 0;
    try {
      for (;;) {
        polls += 1;
        build = await findBuild(version, buildNumber);
        lastState = build ? build.attributes.processingState : 'NOT_FOUND';
        if (lastState === 'VALID') break;
        if (lastState === 'FAILED' || lastState === 'INVALID') break;
        if (Date.now() + BUILD_POLL_MS > deadline) break;
        await sleep(BUILD_POLL_MS);
      }
    } catch (e) {
      fail('build', e, { polls });
      return out;
    }
    if (lastState !== 'VALID') {
      step('build', 'error', {
        error: `build ${buildNumber} of ${version} is ${lastState} after ${polls} check(s) over up to 30 minutes`,
        buildId: build ? build.id : null,
      });
      return out;
    }
    step('build', 'valid', {
      id: build.id,
      uploadedDate: build.attributes.uploadedDate,
      usesNonExemptEncryption: build.attributes.usesNonExemptEncryption ?? null,
      polls,
    });

    // 6 (done before submitting, Apple requires it). Export compliance on the build.
    if (build.attributes.usesNonExemptEncryption === false || build.attributes.usesNonExemptEncryption === true) {
      step('exportCompliance', 'already set', { usesNonExemptEncryption: build.attributes.usesNonExemptEncryption });
    } else if (!APP_DECLARES_NO_NON_EXEMPT_ENCRYPTION) {
      step('exportCompliance', 'not answered', {
        reason: 'app.json does not declare ITSAppUsesNonExemptEncryption=false; answer it in App Store Connect',
      });
    } else {
      try {
        await asc('PATCH', `/v1/builds/${build.id}`, {
          data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
        });
        step('exportCompliance', 'set', { usesNonExemptEncryption: false, basis: 'qualia-fitness app.json ITSAppUsesNonExemptEncryption=false' });
      } catch (e) {
        fail('exportCompliance', e);
      }
    }

    const attached = ver.relationships && ver.relationships.build && ver.relationships.build.data
      ? ver.relationships.build.data.id
      : null;
    if (attached === build.id) {
      step('attachBuild', 'already attached', { buildId: build.id });
    } else {
      try {
        await asc('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`, {
          data: { type: 'builds', id: build.id },
        });
        step('attachBuild', 'ok', { buildId: build.id, replaced: attached });
      } catch (e) {
        fail('attachBuild', e);
        return out;
      }
    }
  }

  // 3a. Version localization.
  if (Object.keys(versionFields).length) {
    try {
      const locs = await getVersionLocalizations(ver.id);
      const loc = locs.find((l) => l.locale === locale);
      if (loc) {
        const before = Object.fromEntries(Object.keys(versionFields).map((k) => [k, loc[k] ?? null]));
        await asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
          data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: versionFields },
        });
        step('versionLocalization', 'ok', { id: loc.id, before, after: versionFields });
      } else {
        const created = await asc('POST', '/v1/appStoreVersionLocalizations', {
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: { locale, ...versionFields },
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } },
          },
        });
        step('versionLocalization', 'created', { id: created.data.id, after: versionFields });
      }
    } catch (e) {
      fail('versionLocalization', e);
    }
  } else {
    step('versionLocalization', 'skipped', { reason: 'no version fields in the request' });
  }

  // 3b. App info localization (subtitle, privacy policy URL) on the editable app info.
  if (Object.keys(appInfoFields).length) {
    try {
      const infos = await getAppInfos();
      const info = infos.find((i) => i.editable);
      if (!info) {
        step('appInfoLocalization', 'error', {
          error: 'no editable app info',
          appInfos: infos.map((i) => ({ id: i.id, state: i.state })),
        });
      } else {
        const locs = await getAppInfoLocalizations(info.id);
        const loc = locs.find((l) => l.locale === locale);
        if (!loc) {
          step('appInfoLocalization', 'error', { error: `app info ${info.id} has no ${locale} localization` });
        } else {
          const before = Object.fromEntries(Object.keys(appInfoFields).map((k) => [k, loc[k] ?? null]));
          await asc('PATCH', `/v1/appInfoLocalizations/${loc.id}`, {
            data: { type: 'appInfoLocalizations', id: loc.id, attributes: appInfoFields },
          });
          step('appInfoLocalization', 'ok', { appInfoId: info.id, appInfoState: info.state, id: loc.id, before, after: appInfoFields });
        }
      }
    } catch (e) {
      fail('appInfoLocalization', e);
    }
  } else {
    step('appInfoLocalization', 'skipped', { reason: 'no subtitle or privacyPolicyUrl in the request' });
  }

  // 4. Release type.
  if (req.releaseType) {
    try {
      await asc('PATCH', `/v1/appStoreVersions/${ver.id}`, {
        data: { type: 'appStoreVersions', id: ver.id, attributes: { releaseType: req.releaseType } },
      });
      step('releaseType', 'ok', { before: ver.attributes.releaseType ?? null, after: req.releaseType });
    } catch (e) {
      fail('releaseType', e);
    }
  } else {
    step('releaseType', 'skipped', { reason: 'not in the request' });
  }

  // 5. Submit for review.
  const earlierErrors = out.steps.filter((s) => s.status === 'error').map((s) => s.step);
  if (req.submitForReview !== true) {
    step('submit', 'skipped', { reason: 'submitForReview is not true' });
  } else if (!build) {
    step('submit', 'error', { error: 'not submitted: no valid build was attached in this run' });
  } else if (earlierErrors.length) {
    step('submit', 'error', { error: `not submitted because these steps failed: ${earlierErrors.join(', ')}` });
  } else {
    let submissionId = null;
    try {
      const open = await asc(
        'GET',
        `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=10`,
      );
      const reuse = (open.data || []).find((s) => OPEN_SUBMISSION_STATES.has(s.attributes.state));
      if (reuse) {
        submissionId = reuse.id;
        step('reviewSubmission', 'reused', { id: reuse.id, state: reuse.attributes.state });
      } else {
        const created = await asc('POST', '/v1/reviewSubmissions', {
          data: {
            type: 'reviewSubmissions',
            attributes: { platform: 'IOS' },
            relationships: { app: { data: { type: 'apps', id: APP_ID } } },
          },
        });
        submissionId = created.data.id;
        step('reviewSubmission', 'created', { id: submissionId, state: created.data.attributes.state });
      }
    } catch (e) {
      fail('reviewSubmission', e);
    }
    if (submissionId) {
      let itemOk = false;
      try {
        const items = await asc('GET', `/v1/reviewSubmissions/${submissionId}/items?include=appStoreVersion&limit=50`);
        const has = (items.data || []).some((it) => it.relationships && it.relationships.appStoreVersion &&
          it.relationships.appStoreVersion.data && it.relationships.appStoreVersion.data.id === ver.id);
        if (has) {
          itemOk = true;
          step('reviewSubmissionItem', 'already added', { versionId: ver.id });
        } else {
          const item = await asc('POST', '/v1/reviewSubmissionItems', {
            data: {
              type: 'reviewSubmissionItems',
              relationships: {
                reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
                appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
              },
            },
          });
          itemOk = true;
          step('reviewSubmissionItem', 'created', { id: item.data.id, state: item.data.attributes && item.data.attributes.state });
        }
      } catch (e) {
        fail('reviewSubmissionItem', e);
      }
      if (itemOk) {
        try {
          const sub = await asc('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
            data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
          });
          step('submit', 'ok', { reviewSubmissionId: submissionId, state: sub.data.attributes.state, submittedDate: sub.data.attributes.submittedDate ?? null });
          out.reviewSubmissionState = sub.data.attributes.state;
        } catch (e) {
          fail('submit', e, { reviewSubmissionId: submissionId });
        }
      }
    }
  }

  try {
    const after = await findVersion(version);
    out.finalVersionState = after ? versionState(after) : null;
  } catch (e) {
    fail('finalState', e);
  }
  out.ok = out.steps.every((s) => s.status !== 'error');
  return out;
}

// ---------------------------------------------------------------------------
// Diagnose request: ops/requests/app-store/diagnose.json  (read only, except one call)
//   { "version": "1.0.4", "reviewSubmissionId": "optional" }
// Records what blocks a version from review. The only write is a retry of
// POST /v1/reviewSubmissionItems, which Apple accepts only when the version is valid;
// it never submits. Result in last-diagnose.json.
// ---------------------------------------------------------------------------

function nullFields(attrs) {
  return Object.entries(attrs || {}).filter(([, v]) => v === null || v === undefined).map(([k]) => k);
}

async function editableAppInfo() {
  const infos = await getAppInfos();
  return { infos, info: infos.find((i) => i.editable) || infos[0] || null };
}

async function processDiagnose(req) {
  const out = { startedAt: new Date().toISOString(), request: req, checks: {}, errors: [] };
  const check = async (name, fn) => {
    try {
      out.checks[name] = await fn();
    } catch (e) {
      out.errors.push(errorRecord({ check: name }, e));
      out.checks[name] = { error: e.message, apiErrors: e.apiErrors || null };
    }
  };

  let ver = null;
  await check('version', async () => {
    if (req.version) ver = await findVersion(String(req.version));
    if (!ver) {
      const vs = await getVersions();
      const ed = vs.find((v) => v.editable);
      if (ed) ver = (await asc('GET', `/v1/appStoreVersions/${ed.id}?include=build`)).data;
    }
    if (!ver) return { found: false };
    return { id: ver.id, attributes: ver.attributes, buildId: ver.relationships && ver.relationships.build && ver.relationships.build.data ? ver.relationships.build.data.id : null };
  });

  // Retry the item: Apple returns the associated errors that block review.
  let submissionId = req.reviewSubmissionId || null;
  await check('reviewSubmission', async () => {
    const subs = await asc('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`);
    const list = (subs.data || []).map((x) => ({ id: x.id, ...x.attributes }));
    if (!submissionId) {
      const open = list.find((x) => OPEN_SUBMISSION_STATES.has(x.state));
      submissionId = open ? open.id : null;
    }
    let items = null;
    if (submissionId) {
      const it = await asc('GET', `/v1/reviewSubmissions/${submissionId}/items?include=appStoreVersion&limit=50`);
      items = (it.data || []).map((x) => ({ id: x.id, ...x.attributes, appStoreVersionId: x.relationships && x.relationships.appStoreVersion && x.relationships.appStoreVersion.data ? x.relationships.appStoreVersion.data.id : null }));
    }
    return { submissions: list, usedSubmissionId: submissionId, items };
  });
  if (ver && submissionId) {
    const items = (out.checks.reviewSubmission && out.checks.reviewSubmission.items) || [];
    if (items.some((x) => x.appStoreVersionId === ver.id)) {
      out.checks.reviewSubmissionItemRetry = { status: 'already added', note: 'not submitted by diagnose' };
    } else {
      try {
        const item = await asc('POST', '/v1/reviewSubmissionItems', {
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
              appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
            },
          },
        });
        out.checks.reviewSubmissionItemRetry = { status: 'added', id: item.data.id, attributes: item.data.attributes, note: 'item is valid now; diagnose did not submit' };
      } catch (e) {
        out.checks.reviewSubmissionItemRetry = errorRecord({ status: 'error' }, e);
      }
    }
  }

  let info = null;
  await check('appInfo', async () => {
    const r = await editableAppInfo();
    info = r.info;
    if (!info) return { appInfos: r.infos };
    const full = await asc('GET', `/v1/appInfos/${info.id}?include=primaryCategory,secondaryCategory,ageRatingDeclaration`);
    const rel = full.data.relationships || {};
    const id = (k) => (rel[k] && rel[k].data ? rel[k].data.id : null);
    return { appInfos: r.infos, usedAppInfoId: info.id, attributes: full.data.attributes, primaryCategory: id('primaryCategory'), secondaryCategory: id('secondaryCategory') };
  });
  await check('ageRatingDeclaration', async () => {
    if (!info) return { error: 'no app info' };
    const a = await asc('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
    return { id: a.data.id, attributes: a.data.attributes, nullFields: nullFields(a.data.attributes) };
  });
  await check('app', async () => {
    const a = await asc('GET', `/v1/apps/${APP_ID}`);
    return { attributes: a.data.attributes, nullFields: nullFields(a.data.attributes) };
  });
  await check('availability', async () => {
    try {
      const a = await asc('GET', `/v1/apps/${APP_ID}/appAvailabilityV2`);
      const t = await asc('GET', `/v2/appAvailabilities/${a.data.id}/territoryAvailabilities?limit=200`);
      const avail = (t.data || []).filter((x) => x.attributes && x.attributes.available);
      return { id: a.data.id, attributes: a.data.attributes, territoriesListed: (t.data || []).length, territoriesAvailable: avail.length, usAvailable: avail.some((x) => /USA/.test(Buffer.from(x.id, 'base64').toString('utf8')) || /USA/.test(x.id)) };
    } catch (e) {
      if (e.status === 404) return { exists: false, note: 'no app availability set' };
      throw e;
    }
  });
  await check('priceSchedule', async () => {
    try {
      const p = await asc('GET', `/v1/apps/${APP_ID}/appPriceSchedule?include=manualPrices,baseTerritory`);
      return { id: p.data.id, baseTerritory: p.data.relationships && p.data.relationships.baseTerritory && p.data.relationships.baseTerritory.data ? p.data.relationships.baseTerritory.data.id : null, manualPrices: (p.included || []).filter((x) => x.type === 'appPrices').length, note: 'read only' };
    } catch (e) {
      if (e.status === 404) return { exists: false };
      throw e;
    }
  });
  if (ver) {
    await check('reviewDetail', async () => {
      try {
        const d = await asc('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`);
        if (!d || !d.data) return { exists: false };
        const attrs = { ...d.data.attributes };
        if (attrs.demoAccountPassword) attrs.demoAccountPassword = '(set, hidden)';
        return { exists: true, id: d.data.id, attributes: attrs, nullFields: nullFields(d.data.attributes) };
      } catch (e) {
        if (e.status === 404) return { exists: false };
        throw e;
      }
    });
    await check('localizationsAndScreenshots', async () => {
      const locs = await getVersionLocalizations(ver.id);
      const res = [];
      for (const l of locs) {
        const sets = await asc('GET', `/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`);
        res.push({
          locale: l.locale,
          nullFields: nullFields({ description: l.description, keywords: l.keywords, supportUrl: l.supportUrl, marketingUrl: l.marketingUrl, whatsNew: l.whatsNew }),
          supportUrl: l.supportUrl ?? null,
          screenshotSets: (sets.data || []).map((x) => ({ displayType: x.attributes.screenshotDisplayType, count: x.relationships && x.relationships.appScreenshots && x.relationships.appScreenshots.data ? x.relationships.appScreenshots.data.length : null })),
        });
      }
      return res;
    });
    await check('build', async () => {
      const b = await asc('GET', `/v1/appStoreVersions/${ver.id}/build`);
      return b && b.data ? { id: b.data.id, attributes: b.data.attributes } : { attached: false };
    });
  }
  await check('appInfoLocalizations', async () => {
    if (!info) return null;
    return getAppInfoLocalizations(info.id);
  });

  out.ok = out.errors.length === 0;
  return out;
}

// ---------------------------------------------------------------------------
// Compliance request: ops/requests/app-store/compliance.json
//   { "version": "1.0.4",
//     "ageRatingDeclaration": { <ageRatingDeclarations attributes> },
//     "reviewDetail": { contactFirstName, contactLastName, contactEmail, contactPhone,
//                       demoAccountRequired, demoAccountName, demoAccountPassword, notes },
//     "contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT" | "USES_THIRD_PARTY_CONTENT",
//     "primaryCategory": "HEALTH_AND_FITNESS", "secondaryCategory": "GAMES_..." }
// Sets the answers App Review needs. Never touches name, prices, availability or in-app purchases.
// Result in last-compliance.json.
// ---------------------------------------------------------------------------

const COMPLIANCE_KNOWN = ['version', 'ageRatingDeclaration', 'reviewDetail', 'contentRightsDeclaration', 'primaryCategory', 'secondaryCategory', 'note', 'requestedAt'];

async function processCompliance(req) {
  const out = { startedAt: new Date().toISOString(), request: { ...req }, steps: [] };
  if (req.reviewDetail && req.reviewDetail.demoAccountPassword) out.request.reviewDetail = { ...req.reviewDetail, demoAccountPassword: '(hidden)' };
  const step = (name, status, details) => { out.steps.push({ step: name, status, at: new Date().toISOString(), ...details }); };
  const fail = (name, e) => out.steps.push(errorRecord({ step: name, status: 'error', at: new Date().toISOString() }, e));
  const unknown = Object.keys(req).filter((k) => !COMPLIANCE_KNOWN.includes(k));
  if (unknown.length) step('validate', 'ignored fields', { fields: unknown });

  let info = null;
  try { info = (await editableAppInfo()).info; } catch (e) { fail('appInfo', e); }

  if (req.ageRatingDeclaration && info) {
    try {
      const a = await asc('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
      const before = Object.fromEntries(Object.keys(req.ageRatingDeclaration).map((k) => [k, a.data.attributes[k] ?? null]));
      const r = await asc('PATCH', `/v1/ageRatingDeclarations/${a.data.id}`, {
        data: { type: 'ageRatingDeclarations', id: a.data.id, attributes: req.ageRatingDeclaration },
      });
      step('ageRatingDeclaration', 'ok', { id: a.data.id, before, after: r.data.attributes, stillNull: nullFields(r.data.attributes) });
    } catch (e) { fail('ageRatingDeclaration', e); }
  }

  if (req.contentRightsDeclaration) {
    try {
      const r = await asc('PATCH', `/v1/apps/${APP_ID}`, {
        data: { type: 'apps', id: APP_ID, attributes: { contentRightsDeclaration: req.contentRightsDeclaration } },
      });
      step('contentRightsDeclaration', 'ok', { after: r.data.attributes.contentRightsDeclaration });
    } catch (e) { fail('contentRightsDeclaration', e); }
  }

  if ((req.primaryCategory || req.secondaryCategory) && info) {
    try {
      const relationships = {};
      if (req.primaryCategory) relationships.primaryCategory = { data: { type: 'appCategories', id: req.primaryCategory } };
      if (req.secondaryCategory) relationships.secondaryCategory = { data: { type: 'appCategories', id: req.secondaryCategory } };
      await asc('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships } });
      step('categories', 'ok', { primaryCategory: req.primaryCategory || null, secondaryCategory: req.secondaryCategory || null });
    } catch (e) { fail('categories', e); }
  }

  if (req.reviewDetail) {
    try {
      let ver = req.version ? await findVersion(String(req.version)) : null;
      if (!ver) {
        const ed = (await getVersions()).find((v) => v.editable);
        ver = ed ? { id: ed.id } : null;
      }
      if (!ver) throw new Error('no version found for reviewDetail');
      let existing = null;
      try {
        const d = await asc('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`);
        existing = d && d.data ? d.data : null;
      } catch (e) { if (e.status !== 404) throw e; }
      let r;
      if (existing) {
        r = await asc('PATCH', `/v1/appStoreReviewDetails/${existing.id}`, {
          data: { type: 'appStoreReviewDetails', id: existing.id, attributes: req.reviewDetail },
        });
      } else {
        r = await asc('POST', '/v1/appStoreReviewDetails', {
          data: { type: 'appStoreReviewDetails', attributes: req.reviewDetail, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } },
        });
      }
      const after = { ...r.data.attributes };
      if (after.demoAccountPassword) after.demoAccountPassword = '(set, hidden)';
      step('reviewDetail', existing ? 'updated' : 'created', { id: r.data.id, after, stillNull: nullFields(r.data.attributes) });
    } catch (e) { fail('reviewDetail', e); }
  }

  out.ok = out.steps.every((s) => s.status !== 'error');
  return out;
}

async function snapshot(errors) {
  const snap = { appId: APP_ID };

  snap.app = await section(errors, 'app', async () => {
    const json = await asc('GET', `/v1/apps/${APP_ID}?fields[apps]=name,bundleId,sku,primaryLocale`);
    return { id: json.data.id, ...json.data.attributes };
  });

  const versions = (await section(errors, 'versions', getVersions)) || [];
  snap.versions = versions;
  snap.liveVersion = versions.find((v) => v.live) || null;
  snap.pendingVersions = versions.filter((v) => !v.live && v.state !== 'REPLACED_WITH_NEW_VERSION' && v.state !== 'REMOVED_FROM_SALE');
  snap.editableVersion = versions.find((v) => v.editable) || null;
  if (!snap.editableVersion) {
    snap.notes = ['No editable App Store version. Listing changes other than promotional text need a new version.'];
  }

  snap.versionLocalizations = {};
  for (const v of [snap.liveVersion, snap.editableVersion].filter(Boolean)) {
    if (snap.versionLocalizations[v.versionString]) continue;
    snap.versionLocalizations[v.versionString] = await section(errors, `versionLocalizations ${v.versionString}`, () =>
      getVersionLocalizations(v.id),
    );
  }

  const appInfos = (await section(errors, 'appInfos', getAppInfos)) || [];
  snap.appInfos = [];
  for (const info of appInfos) {
    const localizations = await section(errors, `appInfoLocalizations ${info.id}`, () => getAppInfoLocalizations(info.id));
    snap.appInfos.push({ ...info, localizations });
  }

  snap.ratingsSummary = await section(errors, 'ratingsSummary', getRatingsSummary);
  snap.customerReviews = await section(errors, 'customerReviews', getReviews);

  return { snap, versions, appInfos };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  const startedAt = new Date().toISOString();
  const errors = [];
  let request = null;
  let requestError = null;

  if (fs.existsSync(REQUEST_FILE)) {
    try {
      request = JSON.parse(fs.readFileSync(REQUEST_FILE, 'utf8'));
      if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be a JSON object');
    } catch (e) {
      requestError = `Could not read listing.json: ${e.message}`;
      request = null;
    }
  }

  try {
    TOKEN = makeToken();
    TOKEN_AT = Date.now();
  } catch (e) {
    errors.push({ section: 'auth', error: e.message });
  }

  let applyResult = null;
  let consumeRequest = true;
  if (TOKEN) {
    // First pass gives the current states; apply; then a fresh snapshot shows the result.
    if (request) {
      const before = errors.length;
      const versions = await section(errors, 'versions (pre-apply)', getVersions);
      const appInfos = await section(errors, 'appInfos (pre-apply)', getAppInfos);
      if (errors.length > before || !versions || !appInfos) {
        consumeRequest = false;
        applyResult = {
          appliedAt: new Date().toISOString(), request, ok: false, requestKept: true,
          errors: errors.slice(before).map((e) => ({ error: e.error })),
          note: 'Could not read current state, nothing applied. listing.json was kept; the next run retries it.',
        };
      } else {
        applyResult = await applyRequest(request, versions, appInfos);
      }
    }
  } else if (request) {
    consumeRequest = false;
    applyResult = {
      appliedAt: new Date().toISOString(), request, ok: false, requestKept: true,
      errors: [{ error: 'not authenticated, nothing applied' }],
      note: 'listing.json was kept; the next run retries it.',
    };
  }
  if (requestError) {
    applyResult = { appliedAt: new Date().toISOString(), ok: false, errors: [{ error: requestError }], note: 'Invalid request file was removed.' };
  }

  // Compliance answers first (age rating, review contact, content rights), then diagnose, then release.
  const extraResults = [];
  for (const [file, name, fn] of [
    [COMPLIANCE_FILE, 'last-compliance.json', processCompliance],
    [DIAGNOSE_FILE, 'last-diagnose.json', processDiagnose],
  ]) {
    if (!fs.existsSync(file)) continue;
    let r;
    let consume = true;
    try {
      const req = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
      if (TOKEN) r = await fn(req);
      else { r = { ok: false, requestKept: true, errors: [{ error: 'not authenticated, nothing done' }] }; consume = false; }
    } catch (e) {
      r = errorRecord({ ok: false, fatal: true }, e);
    }
    r.finishedAt = new Date().toISOString();
    writeJson(path.join(REPORT_DIR, name), r);
    extraResults.push({ file: `ops/reports/app-store/${name}`, ok: r.ok });
    if (consume) fs.unlinkSync(file);
  }

  // Release request (version, build, listing text, review submission).
  let releaseResult = null;
  let consumeRelease = false;
  if (fs.existsSync(RELEASE_FILE)) {
    let releaseReq = null;
    try {
      releaseReq = JSON.parse(fs.readFileSync(RELEASE_FILE, 'utf8'));
      if (!releaseReq || typeof releaseReq !== 'object' || Array.isArray(releaseReq)) throw new Error('request must be a JSON object');
    } catch (e) {
      releaseResult = { startedAt: new Date().toISOString(), ok: false, steps: [{ step: 'read', status: 'error', error: `Could not read release.json: ${e.message}` }], note: 'Invalid request file was removed.' };
      consumeRelease = true;
    }
    if (releaseReq) {
      if (TOKEN) {
        try {
          releaseResult = await processRelease(releaseReq);
        } catch (e) {
          releaseResult = { startedAt: new Date().toISOString(), request: releaseReq, ok: false, steps: [{ step: 'fatal', status: 'error', error: e.message }] };
        }
        consumeRelease = true;
      } else {
        releaseResult = {
          startedAt: new Date().toISOString(), request: releaseReq, ok: false, requestKept: true,
          steps: [{ step: 'auth', status: 'error', error: 'not authenticated, nothing done' }],
          note: 'release.json was kept; the next run retries it.',
        };
      }
    }
    releaseResult.finishedAt = new Date().toISOString();
  }

  let snap = { appId: APP_ID };
  if (TOKEN) ({ snap } = await snapshot(errors));

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    trigger: process.env.GITHUB_EVENT_NAME || 'local',
    runUrl: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
    ok: errors.length === 0,
    errors,
    applied: applyResult ? { ok: applyResult.ok, file: 'ops/reports/app-store/last-apply.json' } : null,
    release: releaseResult ? { ok: releaseResult.ok, file: 'ops/reports/app-store/last-release.json' } : null,
    otherRequests: extraResults.length ? extraResults : null,
    ...snap,
  };

  const day = report.generatedAt.slice(0, 10);
  writeJson(path.join(REPORT_DIR, 'latest.json'), report);
  writeJson(path.join(REPORT_DIR, `${day}.json`), report);
  if (applyResult) {
    writeJson(path.join(REPORT_DIR, 'last-apply.json'), applyResult);
    // The request is consumed once it was attempted (or is invalid); last-apply.json says what happened.
    if (consumeRequest && fs.existsSync(REQUEST_FILE)) fs.unlinkSync(REQUEST_FILE);
  }

  if (releaseResult) {
    writeJson(path.join(REPORT_DIR, 'last-release.json'), releaseResult);
    if (consumeRelease && fs.existsSync(RELEASE_FILE)) fs.unlinkSync(RELEASE_FILE);
  }

  console.log(`Snapshot written (${errors.length} error(s)).`);
  for (const e of errors) console.log(`  ${e.section}: ${e.error}`);
  if (applyResult) console.log(`Apply: ok=${applyResult.ok} changes=${(applyResult.changes || []).length}`);
}

main().catch((e) => {
  // Last resort: still leave a report Claude can read.
  try {
    writeJson(path.join(REPORT_DIR, 'latest.json'), { generatedAt: new Date().toISOString(), ok: false, fatal: e.message });
  } catch (_) { /* ignore */ }
  console.error(e);
  process.exitCode = 1;
});
