export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue: unknown) => defaultValue,
  }),
};

export const window = {
  showErrorMessage: async () => undefined,
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  createTerminal: () => ({ show: () => {}, sendText: () => {} }),
};

export const commands = {
  executeCommand: async () => undefined,
};

export const env = {
  clipboard: { writeText: async () => {} },
  openExternal: async () => false,
};

export const Uri = {
  parse: (s: string) => s,
  file: (s: string) => ({ fsPath: s }),
};
