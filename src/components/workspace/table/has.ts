/** Whether an object holds the key itself (not one it inherits). The one helper the codec and the words share. */
export const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);
