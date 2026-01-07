/**
 * Test Data Fixtures
 *
 * Sample data for E2E tests. Includes valid CSVs, edge cases, and invalid data.
 */

/** Valid CSV with typical lead data */
export const VALID_CSV_CONTENT = `email,first_name,last_name,company,title
john.smith@google.com,John,Smith,Google,Software Engineer
sarah.johnson@microsoft.com,Sarah,Johnson,Microsoft,Product Manager
michael.brown@apple.com,Michael,Brown,Apple,Designer
emily.davis@amazon.com,Emily,Davis,Amazon,Data Scientist
david.wilson@meta.com,David,Wilson,Meta,Engineering Manager`;

/** CSV with mixed valid/invalid domains */
export const MIXED_DOMAINS_CSV = `email,first_name,last_name,company,title
valid@google.com,Valid,User,Google,Engineer
invalid@thisisnotarealdomain12345.com,Invalid,Domain,Fake Co,Manager
test@microsoft.com,Test,User,Microsoft,Developer
bad@anotherfakedomain99999.xyz,Bad,Email,Nowhere Inc,CEO`;

/** CSV with only email column */
export const MINIMAL_CSV_CONTENT = `email
test1@google.com
test2@microsoft.com
test3@apple.com`;

/** CSV with special characters and edge cases */
export const EDGE_CASES_CSV = `email,first_name,last_name,company,title
"user+tag@gmail.com",John,"O'Brien","Company, Inc.","VP, Sales"
normal@example.com,Jane,Doe,Example Corp,Manager
"quoted.email"@domain.com,Test,User,Test Co,Developer`;

/** CSV with duplicate domains (should be deduplicated) */
export const DUPLICATE_DOMAINS_CSV = `email,first_name,last_name,company,title
user1@google.com,User,One,Google,Engineer
user2@google.com,User,Two,Google,Designer
user3@google.com,User,Three,Google,Manager
user4@microsoft.com,User,Four,Microsoft,Developer
user5@microsoft.com,User,Five,Microsoft,PM`;

/** Empty CSV (should fail) */
export const EMPTY_CSV = "email,first_name,last_name,company,title";

/** CSV without email column (should fail) */
export const NO_EMAIL_COLUMN_CSV = `name,company,phone
John Smith,Acme Corp,555-1234
Jane Doe,Tech Inc,555-5678`;

/** CSV with invalid emails */
export const INVALID_EMAILS_CSV = `email,first_name,last_name,company,title
notanemail,John,Smith,Company,Title
@nodomain.com,Jane,Doe,Another Co,Manager
missing@,Bob,Wilson,Third Co,Developer
valid@google.com,Valid,User,Google,Engineer`;

/** Large CSV for performance testing */
export function generateLargeCsv(rowCount: number): string {
  const domains = [
    "google.com",
    "microsoft.com",
    "apple.com",
    "amazon.com",
    "meta.com",
    "salesforce.com",
    "oracle.com",
    "ibm.com",
    "adobe.com",
    "vmware.com",
  ];
  const titles = [
    "Engineer",
    "Manager",
    "Director",
    "VP",
    "CEO",
    "Designer",
    "Analyst",
    "Consultant",
  ];

  let csv = "email,first_name,last_name,company,title\n";

  for (let i = 0; i < rowCount; i++) {
    const domain = domains[i % domains.length];
    const title = titles[i % titles.length];
    csv += `user${i}@${domain},First${i},Last${i},Company${i},${title}\n`;
  }

  return csv;
}

/** Test file creation helper */
export function createTestFile(
  content: string,
  filename = "test-leads.csv",
  type = "text/csv"
): File {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
}

/** Expected domains from VALID_CSV_CONTENT */
export const EXPECTED_VALID_DOMAINS = [
  "google.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "meta.com",
];

/** Security gateway domains for testing detection */
export const SECURITY_GATEWAY_DOMAINS = [
  "proofpoint-protected.com",
  "mimecast-secured.com",
  "barracuda-filtered.com",
];
