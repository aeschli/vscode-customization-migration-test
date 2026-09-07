/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export function respond(request, label = 'fixture', cwd = process.cwd()) {
	if (request?.id === undefined) {
		return undefined;
	}
	const response = { jsonrpc: '2.0', id: request.id };
	switch (request.method) {
		case 'initialize':
			return { ...response, result: {
				protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'customization-migration-fixture', version: '1.0.0' },
			} };
		case 'ping':
			return { ...response, result: {} };
		case 'tools/list':
			return { ...response, result: { tools: [{
				name: 'migration_probe',
				description: 'Return the fixture label and working directory without reading or writing files.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false },
				annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
			}] } };
		case 'tools/call':
			return request.params?.name === 'migration_probe'
				? { ...response, result: { content: [{ type: 'text', text: JSON.stringify({ label, cwd }) }] } }
				: { ...response, error: { code: -32602, message: 'Unknown fixture tool' } };
		default:
			return { ...response, error: { code: -32601, message: 'Method not found' } };
	}
}

function parseResponse(text, label) {
	try {
		return respond(JSON.parse(text), label);
	} catch {
		return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } };
	}
}

export function createHttpFixture(label = 'http-fixture') {
	return createServer(async (request, response) => {
		if (request.method !== 'POST' || request.url !== '/mcp') {
			response.writeHead(405, { Allow: 'POST' }).end();
			return;
		}
		try {
			const chunks = [];
			let size = 0;
			for await (const chunk of request) {
				size += chunk.length;
				if (size > 1024 * 1024) {
					response.writeHead(413).end();
					return;
				}
				chunks.push(chunk);
			}
			const result = parseResponse(Buffer.concat(chunks).toString(), label);
			if (result === undefined) {
				response.writeHead(202).end();
			} else {
				response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
			}
		} catch {
			if (!response.headersSent) {
				response.writeHead(400);
			}
			response.end();
		}
	});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	if (process.argv[2] === '--http') {
		const port = Number(process.argv[3] ?? 48123);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error('Expected a port between 1 and 65535.');
		}
		const server = createHttpFixture();
		server.on('error', error => { console.error(error.message); process.exitCode = 1; });
		server.listen(port, '127.0.0.1', () => console.error(`Fixture MCP endpoint: http://127.0.0.1:${port}/mcp`));
	} else {
		const label = process.argv[2] ?? 'stdio-fixture';
		const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
		input.on('line', line => {
			if (!line.trim()) {
				return;
			}
			const response = parseResponse(line, label);
			if (response !== undefined) {
				process.stdout.write(`${JSON.stringify(response)}\n`);
			}
		});
	}
}