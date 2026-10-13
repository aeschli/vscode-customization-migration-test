/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

// A loopback MCP server protected by its own minimal OAuth authorization server, for testing sign-in
// with a configured OAuth client ID. It has no dynamic client registration, so clients must use one
// of the configured client IDs below. Authorization is approved automatically. Fixture values only:
// never reuse them anywhere else.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { respond } from './mock-server.mjs';

const clients = new Map([
	['fixture-public-client', { secret: undefined }],
	['fixture-confidential-client', { secret: 'fixture-secret-not-real' }],
]);
const scope = 'fixture.read';

export function createOAuthFixture(port) {
	const origin = `http://127.0.0.1:${port}`;
	const resource = `${origin}/mcp`;
	const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource/mcp`;
	const codes = new Map();
	const accessTokens = new Map();
	const refreshTokens = new Map();

	const resourceMetadata = { resource, authorization_servers: [origin], scopes_supported: [scope], resource_name: 'OAuth migration fixture' };
	const serverMetadata = {
		issuer: origin,
		authorization_endpoint: `${origin}/authorize`,
		token_endpoint: `${origin}/token`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
		scopes_supported: [scope],
	};

	const issueTokens = clientId => {
		const accessToken = randomBytes(24).toString('hex');
		const refreshToken = randomBytes(24).toString('hex');
		accessTokens.set(accessToken, { clientId, expiresAt: Date.now() + 3600_000 });
		refreshTokens.set(refreshToken, { clientId });
		return { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: refreshToken, scope };
	};

	return createServer(async (request, response) => {
		const url = new URL(request.url ?? '/', origin);
		const json = (status, body, headers = {}) => response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
		const log = message => console.error(`[oauth-fixture] ${message}`);
		try {
			if (request.method === 'GET' && (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/.well-known/oauth-protected-resource/mcp')) {
				return json(200, resourceMetadata);
			}
			if (request.method === 'GET' && (url.pathname === '/.well-known/oauth-authorization-server' || url.pathname === '/.well-known/openid-configuration')) {
				return json(200, serverMetadata);
			}
			if (request.method === 'GET' && url.pathname === '/authorize') {
				const clientId = url.searchParams.get('client_id') ?? '';
				const redirectUri = url.searchParams.get('redirect_uri') ?? '';
				if (!clients.has(clientId)) {
					log(`authorize rejected unknown client '${clientId}'`);
					return response.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Unknown client_id '${clientId}'. This fixture has no dynamic client registration.`);
				}
				if (url.searchParams.get('response_type') !== 'code' || !URL.canParse(redirectUri)) {
					return response.writeHead(400, { 'Content-Type': 'text/plain' }).end('Expected response_type=code and a redirect_uri.');
				}
				const code = randomBytes(16).toString('hex');
				codes.set(code, { clientId, redirectUri, codeChallenge: url.searchParams.get('code_challenge') ?? undefined });
				const redirect = new URL(redirectUri);
				redirect.searchParams.set('code', code);
				const state = url.searchParams.get('state');
				if (state !== null) {
					redirect.searchParams.set('state', state);
				}
				log(`authorize approved client '${clientId}'`);
				return response.writeHead(302, { Location: redirect.toString() }).end();
			}
			if (request.method === 'POST' && url.pathname === '/token') {
				const form = new URLSearchParams(await readBody(request));
				let clientId = form.get('client_id') ?? undefined;
				let clientSecret = form.get('client_secret') ?? undefined;
				const basic = /^Basic (?<credentials>.+)$/i.exec(request.headers.authorization ?? '')?.groups?.credentials;
				if (basic) {
					const [id, secret] = Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent);
					clientId = id;
					clientSecret = secret;
				}
				const client = clientId ? clients.get(clientId) : undefined;
				if (!client || (client.secret !== undefined && !safeEqual(clientSecret, client.secret))) {
					log(`token rejected client '${clientId}': ${client ? 'missing or wrong client secret' : 'unknown client'}`);
					return json(401, { error: 'invalid_client' });
				}
				if (form.get('grant_type') === 'authorization_code') {
					const code = codes.get(form.get('code') ?? '');
					codes.delete(form.get('code') ?? '');
					const verifier = form.get('code_verifier') ?? '';
					if (!code || code.clientId !== clientId || code.redirectUri !== form.get('redirect_uri')
						|| (code.codeChallenge !== undefined && createHash('sha256').update(verifier).digest('base64url') !== code.codeChallenge)) {
						log(`token rejected an invalid authorization code for '${clientId}'`);
						return json(400, { error: 'invalid_grant' });
					}
					log(`token issued to '${clientId}'`);
					return json(200, issueTokens(clientId));
				}
				if (form.get('grant_type') === 'refresh_token') {
					const refresh = refreshTokens.get(form.get('refresh_token') ?? '');
					if (!refresh || refresh.clientId !== clientId) {
						return json(400, { error: 'invalid_grant' });
					}
					refreshTokens.delete(form.get('refresh_token') ?? '');
					log(`token refreshed for '${clientId}'`);
					return json(200, issueTokens(clientId));
				}
				return json(400, { error: 'unsupported_grant_type' });
			}
			if (url.pathname === '/mcp') {
				if (request.method !== 'POST') {
					return response.writeHead(405, { Allow: 'POST' }).end();
				}
				const token = /^Bearer (?<token>.+)$/i.exec(request.headers.authorization ?? '')?.groups?.token;
				const session = token ? accessTokens.get(token) : undefined;
				if (!session || session.expiresAt < Date.now()) {
					return response.writeHead(401, {
						'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scope}"${token ? ', error="invalid_token"' : ''}`,
					}).end();
				}
				const result = parseRequest(await readBody(request), `oauth:${session.clientId}`);
				return result === undefined ? response.writeHead(202).end() : json(200, result);
			}
			response.writeHead(404).end();
		} catch {
			if (!response.headersSent) {
				response.writeHead(400);
			}
			response.end();
		}
	});
}

async function readBody(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 1024 * 1024) {
			throw new Error('Request body too large');
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString();
}

function parseRequest(text, label) {
	try {
		return respond(JSON.parse(text), label);
	} catch {
		return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } };
	}
}

function safeEqual(actual, expected) {
	const a = Buffer.from(actual ?? '');
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const port = Number(process.argv[2] ?? 48124);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('Expected a port between 1 and 65535.');
	}
	const server = createOAuthFixture(port);
	server.on('error', error => { console.error(error.message); process.exitCode = 1; });
	server.listen(port, '127.0.0.1', () => console.error(`OAuth fixture MCP endpoint: http://127.0.0.1:${port}/mcp`));
}
