export interface IRandomProvider {
  next(): number;
  fork(scope: string | number): IRandomProvider;
}
