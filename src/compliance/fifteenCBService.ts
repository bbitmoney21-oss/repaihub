// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CB is now Form 146 | Section 195 is now Section 397(3)(d)
// CA uses WISEMAN to prepare Form 146. This service formats the data.

export interface WisemanFields {
  assessee_pan: string;
  assessee_name: string;
  nature_of_remittance: string;
  amount_inr: string;
  amount_foreign_currency: string;
  foreign_currency_code: string;
  country_of_remittance: string;
  bank_name: string;
  purpose_code: string;
  tds_section: string;
  tds_rate: string;
  dtaa_applicable: string;
  dtaa_article: string;
}

export function buildWisemanFields(
  panLast4: string,
  customerName: string,
  sourceOfFunds: string,
  amountINR: number,
  netAmountCAD: number,
  purposeCode: string,
  tdsRate: number,
): WisemanFields {
  const sourceLabels: Record<string, string> = {
    rental_income: 'Income from House Property (Rent)',
    dividend_income: 'Dividend Income',
    property_sale: 'Sale of Immovable Property',
    pension: 'Pension Income',
    salary_arrears: 'Salary / Arrears',
    matured_investment: 'Matured Investment / Fixed Deposit',
    gift_from_relative: 'Gift from Relative',
    other: 'Other Income',
  };

  return {
    assessee_pan: `****${panLast4}`,
    assessee_name: customerName,
    nature_of_remittance: sourceLabels[sourceOfFunds] ?? sourceOfFunds,
    amount_inr: `₹${amountINR.toLocaleString('en-IN')}`,
    amount_foreign_currency: `CAD ${netAmountCAD.toFixed(2)}`,
    foreign_currency_code: 'CAD',
    country_of_remittance: 'Canada',
    bank_name: 'AD Bank via Fable Fintech',
    purpose_code: purposeCode,
    // IT Act 2025: Section 397(3)(d) replaces Section 195
    tds_section: '397(3)(d) [IT Act 2025] / 195 [IT Act 1961 — legacy]',
    tds_rate: `${tdsRate}%`,
    dtaa_applicable: 'Yes',
    dtaa_article: 'Article 23 — India-Canada DTAA 1996',
  };
}
