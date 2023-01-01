"use strict";
const vscode = require('vscode');
const extensionShortName = 'betterWhitespaceV2';

function isArray(obj) { return Array.isArray(obj);}
function getProperty(objs, props, deflt) {
  if (!isArray(props)) { props = [props]; }
  for (const obj of (isArray(objs) ? objs : [objs])) {
    for (const prop of props) {
      if (obj.hasOwnProperty(prop)) { return obj[prop]; }
    }
  }
  return deflt;
}
const copyProperties = (src, dest, excludeKeys) => {
  if (!excludeKeys) { excludeKeys = {}; }
  for (const key in src) {
    if (src.hasOwnProperty(key) && !excludeKeys.hasOwnProperty(key)) {
      dest[key] = src[key];
    }
  }
};

function activate(context) {
  const whiteSpace = new WhiteSpace();
  vscode.workspace.onDidChangeConfiguration( configevent => {
    if (configevent.affectsConfiguration(extensionShortName) || configevent.affectsConfiguration('editor') || configevent.affectsConfiguration('workbench')) { whiteSpace.updateConfigurations(); }
  }, null, context.subscriptions);
  vscode.window.onDidChangeTextEditorSelection( changeEvent => { whiteSpace.updateEditor(changeEvent.textEditor); }, null, context.subscriptions);
}

class WhiteSpace {

  constructor() {
    this.disableExtension = false;
    this.spaceDecoration = undefined;
    this.tabDecoration = undefined;
    this.showRenderWhitespaceMessage = true;
    this.updateConfigurations();
  }

  constructDecoration(kind, ...colors) {
    // textDecoration: "none; background: linear-gradient(90deg, #dc143cb3, #dc143cb3) no-repeat center/25% 40%"
    return {
      textDecoration: `none; background: linear-gradient(${getProperty(colors, kind+'.gradient.angle')}deg, `+
        `${getProperty(colors, [kind, 'color'])}, ${getProperty(colors, [kind+'.to', kind, 'color'])}) no-repeat center/`+
        `${getProperty(colors, kind+'.gradient.width')}% ${getProperty(colors, kind+'.gradient.height')}%`
    };
  }
  getDecoration(kind, colorDef, themeColors, lightColors, darkColors) {
    if (themeColors) {
      return this.constructDecoration(kind, themeColors, colorDef);
    }
    let result = this.constructDecoration(kind, colorDef);
    result.light = this.constructDecoration(kind, lightColors, colorDef);
    result.dark = this.constructDecoration(kind, darkColors, colorDef);
    return result;
  }
  updateConfigurations() {
    this.clearDecorations();
    let configurations = vscode.workspace.getConfiguration(extensionShortName);
    let editorConfig = vscode.workspace.getConfiguration("editor");
    let renderWhitespace = editorConfig.get("renderWhitespace");
    this.disableExtension = renderWhitespace !== "none";
    if (this.disableExtension && this.showRenderWhitespaceMessage) {
      vscode.window.showInformationMessage(`Setting "editor.renderWhitespace" is not "none". The extension will be disabled.`);
      this.showRenderWhitespaceMessage = false;
    }
    let workbenchConfig = vscode.workspace.getConfiguration("workbench");
    let themeName = workbenchConfig.get("colorTheme");
    const colors = configurations.get("colors");
    let colorDef = {
      "space.gradient.angle": configurations.get("space.gradient.angle"),
      "space.gradient.width": configurations.get("space.gradient.width"),
      "space.gradient.height": configurations.get("space.gradient.height"),
      "tab.gradient.angle": configurations.get("tab.gradient.angle"),
      "tab.gradient.width": configurations.get("tab.gradient.width"),
      "tab.gradient.height": configurations.get("tab.gradient.height"),
    };
    copyProperties(colors, colorDef);
    let hasDefaultColor = getProperty(colors, 'color') !== undefined;
    colorDef.color = getProperty(colors, 'color', '#dc143cb3');
    let themeColors = getProperty(colors, `[${themeName}]`);
    let lightColors = {};
    copyProperties(getProperty(colors, 'light', {}), lightColors);
    if (!hasDefaultColor) {
      lightColors.color = getProperty(lightColors, 'color', '#dc143cb3');
    }
    let darkColors = {};
    copyProperties(getProperty(colors, 'dark', {}), darkColors);
    if (!hasDefaultColor) {
      // darkColors.color = getProperty(darkColors, 'color', '#da5b74cb');
      darkColors.color = getProperty(darkColors, 'color', '#dc143cb3');
    }

    this.spaceDecoration = vscode.window.createTextEditorDecorationType(this.getDecoration('space', colorDef, themeColors, lightColors, darkColors));
    this.tabDecoration = vscode.window.createTextEditorDecorationType(this.getDecoration('tab', colorDef, themeColors, lightColors, darkColors));
    if (!this.disableExtension)
      this.updateDecorations();
  }

  clearDecorations() {
    vscode.window.visibleTextEditors.forEach(this.clearEditor, this);
  }

  /** @param {vscode.TextEditor} editor */
  clearEditor(editor) {
    if (this.spaceDecoration) {
      editor.setDecorations(this.spaceDecoration, []);
    }
    if (this.tabDecoration) {
      editor.setDecorations(this.tabDecoration, []);
    }
  }

  updateDecorations() {
    if (!this.spaceDecoration || this.disableExtension) {
      this.clearDecorations();
      return;
    }
    vscode.window.visibleTextEditors.forEach(this.updateEditor, this);
  }

  /** @param {vscode.TextEditor} editor */
  updateEditor(editor) {
    if (!this.spaceDecoration || this.disableExtension) {
      this.clearEditor(editor);
      return;
    }

    let whitespaceRanges = [];
    let tabRanges = [];

    editor.selections.forEach(selection => {
      if (selection.isEmpty)
        return;

      const selectionFirstLine = selection.start.line;
      const selectionLastLine = selection.end.line;

      for (let currentLineNum = selectionFirstLine; currentLineNum <= selectionLastLine; ++currentLineNum) {
        const line = editor.document.lineAt(currentLineNum).text;

        let charNum = currentLineNum === selectionFirstLine ? selection.start.character : 0;
        let lineLength = currentLineNum === selectionLastLine ? selection.end.character : line.length;

        for (; charNum < lineLength; ++charNum) {
          const ch = line[charNum];
          if (ch === '\t')
            tabRanges.push(new vscode.Range(currentLineNum, charNum, currentLineNum, charNum+1));
          else if (ch === ' ')
            whitespaceRanges.push(new vscode.Range(currentLineNum, charNum, currentLineNum, charNum+1));
        }
      }
    });

    editor.setDecorations(this.spaceDecoration, whitespaceRanges);
    editor.setDecorations(this.tabDecoration, tabRanges);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
