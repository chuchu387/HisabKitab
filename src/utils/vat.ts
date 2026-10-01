type VatOrganization = {
  vatRegistered?: boolean | null;
  vatEffectiveDate?: Date | string | null;
};

export function isVatApplicableForDate(requested: boolean, organization: VatOrganization | null | undefined, transactionDate: Date) {
  if (!requested || !organization?.vatRegistered) return false;
  if (!organization.vatEffectiveDate) return true;
  return dateKey(transactionDate) >= dateKey(new Date(organization.vatEffectiveDate));
}

export function vatEffectiveDateLabel(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function vatEffectiveStartOfDay(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}
