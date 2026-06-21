import puppeteer from 'puppeteer';

async function verifyRetryButton() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport for desktop
  await page.setViewport({ width: 1400, height: 900 });

  console.log('1. Navigating to home page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  // Look for group cards (not the new group button)
  const groupCards = await page.$$('a[href^="/groups/"]:not([href="/groups/new"])');
  console.log(`Found ${groupCards.length} group cards`);

  if (groupCards.length > 0) {
    console.log('2. Clicking on first group card...');
    await groupCards[0].click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the page to fully load
    await page.waitForSelector('button', { timeout: 5000 });

    console.log('3. Taking screenshot of group page (viewport only)...');
    // Take only viewport screenshot, not full page
    await page.screenshot({ path: 'screenshots/04-processing-panel.png', fullPage: false });
    console.log('Screenshot saved: screenshots/04-processing-panel.png');
  } else {
    console.log('No existing group cards found.');
  }

  await browser.close();
}

verifyRetryButton().catch(console.error);
