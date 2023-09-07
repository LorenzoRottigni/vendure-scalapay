export const errorToString = (exception: unknown): string => {
  if (exception instanceof Error) {
    if (exception.stack) {
      return ' msg: ' + exception.message + ' stack: ' + exception.stack;
    }
    return ' msg: ' + exception.message;
  }

  return `Generic error unknow`;
};
