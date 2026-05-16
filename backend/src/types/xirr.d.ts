declare module 'xirr' {
  interface Transaction {
    amount: number;
    when: Date;
  }
  function xirr(transactions: Transaction[]): number;
  export = xirr;
}
