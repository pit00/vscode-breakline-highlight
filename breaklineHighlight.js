"use strict";
const vscode = require('vscode');
const extensionShortName = 'breaklineHighlight';

function activate(context) {
  const whiteSpace = new WhiteSpace();

  vscode.workspace.onDidChangeConfiguration(configevent => {
    if (
      configevent.affectsConfiguration(extensionShortName) ||
      configevent.affectsConfiguration('editor') ||
      configevent.affectsConfiguration('workbench')
    ) {
      whiteSpace.updateConfigurations();
    }
  }, null, context.subscriptions);

  vscode.window.onDidChangeTextEditorSelection(changeEvent => {
    whiteSpace.updateEditor(changeEvent.textEditor);
  }, null, context.subscriptions);

  // --- EOL change detection ---
  let lastEol = vscode.window.activeTextEditor?.document.eol;

  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      if (lastEol !== editor.document.eol) {
        whiteSpace.updateConfigurations();
      }
      lastEol = editor.document.eol;
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidSaveTextDocument(document => {
    const editor = vscode.window.activeTextEditor;
    if (editor && document === editor.document) {
      if (lastEol !== document.eol) {
        whiteSpace.updateConfigurations();
      }
      lastEol = document.eol;
    }
  }, null, context.subscriptions);
}

class WhiteSpace {

  constructor() {
    this.disableExtension = false;
    this.breaklineDecoration = undefined;
    // this.spaceDecoration = undefined;
    // this.tabDecoration = undefined;
    this.updateConfigurations();
  }

  updateConfigurations() {
    this.clearDecorations();
    let config = vscode.workspace.getConfiguration(extensionShortName);
    
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    
    let text = config.get("lf.text")
    if (editor.document.eol === vscode.EndOfLine.CRLF) {
      text = config.get("crlf.text")
    }
    
    this.breaklineDecoration = vscode.window.createTextEditorDecorationType({
      before: {
        width: "0",
        contentText: text,
        color: config.get("color")
      },
    });
    // this.spaceDecoration = vscode.window.createTextEditorDecorationType(this.getDecoration('space', colorDef, themeColors, lightColors, darkColors));
    // this.tabDecoration = vscode.window.createTextEditorDecorationType(this.getDecoration('tab', colorDef, themeColors, lightColors, darkColors));
    if (!this.disableExtension)
      this.updateDecorations();
  }

  clearDecorations() {
    vscode.window.visibleTextEditors.forEach(this.clearEditor, this);
  }

  /** @param {vscode.TextEditor} editor */
  clearEditor(editor) {
    if (this.breaklineDecoration) {
      editor.setDecorations(this.breaklineDecoration, []);
    }
    // if (this.spaceDecoration) {
    //   editor.setDecorations(this.spaceDecoration, []);
    // }
    // if (this.tabDecoration) {
    //   editor.setDecorations(this.tabDecoration, []);
    // }
  }

  updateDecorations() {
    if (!this.breaklineDecoration || this.disableExtension) {
      this.clearDecorations();
      return;
    }
    vscode.window.visibleTextEditors.forEach(this.updateEditor, this);
  }

  /** @param {vscode.TextEditor} editor */
  updateEditor(editor) {
    if (!this.breaklineDecoration || this.disableExtension) {
      this.clearEditor(editor);
      return;
    }

    let breaklineRanges = [];
    // let whitespaceRanges = [];
    // let tabRanges = [];

    editor.selections.forEach(selection => {
      if (selection.isEmpty)
        return;

      const selectionFirstLine = selection.start.line;
      const selectionLastLine = selection.end.line;

      for (let currentLineNum = selectionFirstLine; currentLineNum <= selectionLastLine; ++currentLineNum) {
        const lineObj = editor.document.lineAt(currentLineNum);
        const line = lineObj.text;

        // let charNum = currentLineNum === selectionFirstLine ? selection.start.character : 0;
        let lineLength = currentLineNum === selectionLastLine ? selection.end.character : line.length;

        // for (; charNum < lineLength; ++charNum) {
        //   const ch = line[charNum];
        //   if (ch === '\t')
        //     tabRanges.push(new vscode.Range(currentLineNum, charNum, currentLineNum, charNum+1));
        //   else if (ch === ' ')
        //     whitespaceRanges.push(new vscode.Range(currentLineNum, charNum, currentLineNum, charNum+1));
        // }

        // Highlight breakline only if selection includes it
        if (
          currentLineNum < editor.document.lineCount - 1 &&
          currentLineNum < selectionLastLine && lineLength === line.length
          // || (currentLineNum === selectionLastLine && selection.end.character === line.length) )
        ) {
          const breakStart = lineObj.range.end;
          const breakEnd = lineObj.rangeIncludingLineBreak.end;
          if (!breakStart.isEqual(breakEnd)) {
            breaklineRanges.push(new vscode.Range(breakStart, breakEnd));
          }
        }
      }
    });

    editor.setDecorations(this.breaklineDecoration, breaklineRanges);
    // editor.setDecorations(this.spaceDecoration, whitespaceRanges);
    // editor.setDecorations(this.tabDecoration, tabRanges);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
