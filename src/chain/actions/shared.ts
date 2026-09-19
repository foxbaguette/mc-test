/** The single-signer authorization every action here uses. */
export const auth = (account: string, permission: string) => [{ actor: account, permission }]

/** "12.3400 TLM", the asset string token contracts expect. */
export const tlm = (amount: number) => `${amount.toFixed(4)} TLM`
