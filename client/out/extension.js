"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 Telicent LTD. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let defaultClient;
const clients = new Map();
let _sortedWorkspaceFolders;
function sortedWorkspaceFolders() {
    if (_sortedWorkspaceFolders === void 0) {
        _sortedWorkspaceFolders = vscode_1.workspace.workspaceFolders ? vscode_1.workspace.workspaceFolders.map(folder => {
            let result = folder.uri.toString();
            if (result.charAt(result.length - 1) !== '/') {
                result = result + '/';
            }
            return result;
        }).sort((a, b) => {
            return a.length - b.length;
        }) : [];
    }
    return _sortedWorkspaceFolders;
}
vscode_1.workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);
function getOuterMostWorkspaceFolder(folder) {
    const sorted = sortedWorkspaceFolders();
    for (const element of sorted) {
        let uri = folder.uri.toString();
        if (uri.charAt(uri.length - 1) !== '/') {
            uri = uri + '/';
        }
        if (uri.startsWith(element)) {
            return vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.parse(element));
        }
    }
    return folder;
}
function activate(context) {
    const module = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    const outputChannel = vscode_1.window.createOutputChannel('ies-server-client-part');
    function didOpenTextDocument(document) {
        if (document.languageId !== 'ttl' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
            return;
        }
        const uri = document.uri;
        if (uri.scheme === 'untitled' && !defaultClient) {
            const serverOptions = {
                run: { module, transport: node_1.TransportKind.ipc },
                debug: { module, transport: node_1.TransportKind.ipc }
            };
            const clientOptions = {
                documentSelector: [
                    { scheme: 'file', language: 'ttl' }
                ],
                diagnosticCollectionName: 'ies-server-client-part',
                outputChannel: outputChannel
            };
            defaultClient = new node_1.LanguageClient('ies-server-client-part', 'IES Server', serverOptions, clientOptions);
            defaultClient.start();
            return;
        }
        let folder = vscode_1.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            return;
        }
        folder = getOuterMostWorkspaceFolder(folder);
        if (!clients.has(folder.uri.toString())) {
            const serverOptions = {
                run: { module, transport: node_1.TransportKind.ipc },
                debug: { module, transport: node_1.TransportKind.ipc }
            };
            const clientOptions = {
                documentSelector: [
                    { scheme: 'file', language: 'ttl', pattern: `${folder.uri.fsPath}/**/*` }
                ],
                diagnosticCollectionName: 'ies-server-client-part',
                workspaceFolder: folder,
                outputChannel: outputChannel
            };
            const client = new node_1.LanguageClient('ies-server-client-part', 'IES Server', serverOptions, clientOptions);
            client.start();
            clients.set(folder.uri.toString(), client);
        }
    }
    vscode_1.workspace.onDidOpenTextDocument(didOpenTextDocument);
    vscode_1.workspace.textDocuments.forEach(didOpenTextDocument);
    vscode_1.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
            const client = clients.get(folder.uri.toString());
            if (client) {
                clients.delete(folder.uri.toString());
                client.stop();
            }
        }
    });
}
exports.activate = activate;
function deactivate() {
    const promises = [];
    if (defaultClient) {
        promises.push(defaultClient.stop());
    }
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map