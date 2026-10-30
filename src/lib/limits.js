// Per-user caps. Keep in sync with firestore.rules (circuits: `projectCount <= 5`, folders: the three
// `<uid>_1..3` ids, follows: `handles.size() <= 500`).
export const MAX_PROJECTS = 5;
export const MAX_FOLDERS = 3;
export const MAX_FOLLOWS = 500;
