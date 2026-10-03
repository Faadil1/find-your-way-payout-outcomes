import { expect, test } from "@playwright/test";

test("live browser hero flow reaches usable and returned outcomes", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /“Sent” is not an outcome/i })).toBeVisible();

  await page.getByRole("button", { name: /Prepare live Testnet demo/i }).click();
  await expect(page.getByTestId("recipient-ready")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("recipient-unready")).toContainText("NO_TARGET_TRUSTLINE");

  await page.getByRole("button", { name: /Show naive failure/i }).click();
  await expect(page.getByText("op_no_trust").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("recipient-unready")).toHaveAttribute(
    "data-outcome",
    "FAILED_NO_FUNDS_MOVED",
  );

  await page.getByRole("button", { name: /Run assured batch/i }).click();
  await expect(page.getByTestId("recipient-ready")).toHaveAttribute(
    "data-outcome",
    "USABLE",
    { timeout: 90_000 },
  );
  await expect(page.getByTestId("recipient-unready")).toHaveAttribute(
    "data-outcome",
    "CLAIMABLE",
  );

  await page.getByRole("button", { name: /Make Ben ready \+ claim/i }).click();
  await expect(page.getByTestId("recipient-unready")).toHaveAttribute(
    "data-outcome",
    "USABLE",
    { timeout: 60_000 },
  );
  await expect(page.getByText("Claim verified").first()).toBeVisible();

  await page.getByRole("button", { name: /Start return clock/i }).click();
  await expect(page.getByTestId("recipient-returnOnly")).toHaveAttribute(
    "data-outcome",
    "CLAIMABLE",
    { timeout: 60_000 },
  );

  const reclaim = page.getByRole("button", { name: /Reclaim to treasury|Reclaim after cutoff/i });
  await expect(reclaim).toBeEnabled({ timeout: 45_000 });
  await reclaim.click();
  await expect(page.getByTestId("recipient-returnOnly")).toHaveAttribute(
    "data-outcome",
    "RETURNED",
    { timeout: 60_000 },
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export evidence receipt/i }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/payout-outcomes-receipt.json");

  await page.screenshot({
    path: "test-results/live-core-loop.png",
    fullPage: true,
  });
});
