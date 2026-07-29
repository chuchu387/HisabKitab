export function emptyFinancialStatements(from?: string, to?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const periodFrom = from || today;
  const periodTo = to || today;
  const summary = {
    revenue: 0,
    cashReceived: 0,
    ownerFunds: 0,
    clientProjectExpenses: 0,
    internalProjectExpenses: 0,
    generalExpenses: 0,
    totalExpenses: 0,
    grossProfit: 0,
    netProfitBeforeTax: 0,
    estimatedTaxPayable: 0,
    outputVatCollected: 0,
    outputVatCollectedToDate: 0,
    netProfitAfterTax: 0,
    cashAtBank: 0,
    accountsReceivable: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    ownerEquity: 0
  };
  return {
    period: { from: periodFrom, to: periodTo, label: `${periodFrom} to ${periodTo}` },
    summary,
    balanceSheet: {
      assets: [
        { account: "Cash / Bank Balance", amount: 0 },
        { account: "Accounts Receivable", amount: 0 }
      ],
      liabilities: [
        { account: "Estimated Tax Provision", amount: 0 },
        { account: "Accounts Payable", amount: 0 }
      ],
      equity: [
        { account: "Owner/Other Funds To Date", amount: 0 },
        { account: "Retained Earnings / Balancing Equity", amount: 0 }
      ]
    },
    profitAndLoss: [
      { account: "Client Project Revenue", amount: 0 },
      { account: "Direct Client Project Expenses", amount: 0 },
      { account: "Gross Profit", amount: 0 },
      { account: "Internal Project Expenses", amount: 0 },
      { account: "General/Admin Expenses", amount: 0 },
      { account: "Net Profit Before Tax", amount: 0 },
      { account: "Estimated Tax Provision", amount: 0 },
      { account: "Net Profit After Tax", amount: 0 }
    ],
    cashFlow: [
      { account: "Client Payments Received", amount: 0 },
      { account: "Owner/Other Funds Received", amount: 0 },
      { account: "Approved Expenses Paid", amount: 0 },
      { account: "Net Cash Movement In Period", amount: 0 },
      { account: "Cash / Bank Balance At Period End", amount: 0 }
    ],
    trialBalance: [],
    expenseByCategory: [],
    expenseByProject: [],
    receivables: []
  };
}

export function emptyLedger() {
  return { entries: [], summary: [] };
}
