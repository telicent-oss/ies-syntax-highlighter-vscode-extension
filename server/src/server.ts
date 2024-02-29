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

import {
	createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind,
	CompletionItemKind, CompletionParams, CompletionItem, Hover, Diagnostic, DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const records = require('../src/records.json');

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


let workspaceFolder: string | null;

documents.onDidOpen((event) => {
	validateTextDocument(event.document);
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
});
documents.listen(connection);

function validateTextDocument(textDocument: TextDocument): void {
    const diagnostics: Diagnostic[] = [];
    const lines = textDocument.getText().split(/\r?\n/g);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
		if (line.startsWith('#')) {
            continue;
        }
		if (/^\s*$/.test(line)) {
            continue;
        }
        if (!(line.endsWith('.') || line.endsWith(',') || line.endsWith(';'))) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                message: `Each line should end with either a dot (.), a comma (,), or a semicolon (;)`,
                source: 'ttl-lsp'
            };
            diagnostics.push(diagnostic);
        }
    }

    // Send the computed diagnostics to the LSP client.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function createCompletionItemFromRecord(key: string, value: string): CompletionItem {
    return {
        label: key,
        kind: CompletionItemKind.Text,
        detail: value,
        documentation: `This item represents a ${key}.`,
        insertText: key, 
    };
}

const documentsContent: Map<string, string> = new Map();

let dataToRecordMap: { [dataId: string]: string } = {};

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
    documentsContent.set(change.document.uri, change.document.getText());
    const documentContent = change.document.getText();

    dataToRecordMap = {};
    const lines = documentContent.split(/\r?\n/g);
    for (const line of lines) {
        const match = line.match(/(data:\S+) a (\S+:\S+)/);  // adjust regex to match any namespace
        if (match) {
            const dataId = match[1];
            const recordType = match[2];
            dataToRecordMap[dataId] = recordType;
        }
    }
});


connection.onHover(
    ({ textDocument: { uri }, position }): Hover | null => {
        const documentContent = documentsContent.get(uri);

        if (documentContent) {
            const lines = documentContent.split(/\r?\n/g);
            const line = lines[position.line];


            for (const record of records) {
                for (const key in record) {
                    if (line.includes(key)) {
                        return {
                            contents: record[key]
                        };
                    }
                }
            }
            

            const match = line.match(/(data:\S+)/); 
            if (match) {
                const dataId = match[0];
                const recordType = dataToRecordMap[dataId];
                if (recordType) {
                    return {
                        contents: recordType
                    };
                }
            }
        }

        return null;
    }
);

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    const documentContent = documentsContent.get(params.textDocument.uri);

    if (documentContent) {
        const lines = documentContent.split(/\r?\n/g);
        const position = params.position;
        const line = lines[position.line];
        const completions: CompletionItem[] = [];

        for (const record of records) {
            for (const key in record) {
                const startString = key.charAt(0).toLowerCase();
                if (line.slice(0, position.character).toLowerCase().endsWith(startString)) {
                    const completionItem = createCompletionItemFromRecord(key, record[key]);
                    completions.push(completionItem);
                }
            }
        }
        // Returns all matching completions
        return completions;
    }

    return [];
});

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        if (item.data === 1) {
            item.detail = 'This is a custom completion item for the word Helloo.';
            item.documentation = 'When you start typing "Hel", this will suggest "Helloo".';
        }
        return item;
    }
);


connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Full
            },
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['i', 'I']
            },
			hoverProvider: true
        }
    };
});

connection.listen();