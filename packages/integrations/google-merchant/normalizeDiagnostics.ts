export function normalizeAccountIssues(accountStatus: any, account: any) {
  return (accountStatus.accountLevelIssues ?? []).map((issue: any) => ({
    tenant_id: account.tenant_id,
    account_id: account.id,
    scope: "account",
    external_product_id: null,
    issue_code: issue.id,
    title: issue.title,
    description: issue.detail ?? null,
    severity: issue.severity,
    servability: null,
    resolution: null,
    attribute_name: null,
    documentation_url: issue.documentation ?? null,
    affected_count: null,
    country: issue.country ?? null,
    destination: null,
    updated_at: new Date().toISOString()
  }));
}

export function normalizeItemIssues(products: any[], account: any) {
  const rows: any[] = [];
  for (const product of products) {
    for (const dest of product.destinationStatuses ?? []) {
      for (const issue of product.itemLevelIssues ?? []) {
        rows.push({
          tenant_id: account.tenant_id,
          account_id: account.id,
          scope: "product",
          external_product_id: product.id ?? product.productId,
          issue_code: issue.code,
          title: issue.description ?? issue.detail ?? issue.code,
          description: issue.detail ?? null,
          severity: issue.servability === "disapproved" ? "critical" : "warning",
          servability: issue.servability ?? null,
          resolution: issue.resolution ?? null,
          attribute_name: issue.attributeName ?? null,
          documentation_url: issue.documentation ?? null,
          affected_count: issue.numItems ? Number(issue.numItems) : null,
          country: dest.country ?? null,
          destination: dest.destination ?? null,
          updated_at: new Date().toISOString()
        });
      }
    }
  }
  return rows;
}
