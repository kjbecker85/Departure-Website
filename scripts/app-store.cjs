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

async function asc(method, urlPath, body) {
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
    throw err;
  }
  return json;
}

// Runs a section and records errors instead of failing the whole snapshot.
async function section(errors, name, fn) {
  try {
    return await fn();
  } catch (e) {
    errors.push({ section: name, error: e.message });
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
        result.errors.push({ target: 'appStoreVersionLocalization', fields: Object.keys(fields), error: e.message });
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
        result.errors.push({ target: 'appInfoLocalization', fields: Object.keys(appInfoChanges), error: e.message });
      }
    }
  }

  result.ok = result.errors.length === 0 && result.skipped.filter((s) => !/unknown fields/.test(s.reason)).length === 0;
  return result;
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
