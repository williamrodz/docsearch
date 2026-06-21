import puppeteer from 'puppeteer';

async function takeScreenshots() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport for desktop
  await page.setViewport({ width: 1400, height: 900 });

  console.log('1. Taking screenshot of home page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

  // Click on the first group card
  console.log('2. Clicking on group card...');
  const groupCard = await page.$('a[href^="/groups/"]');
  if (groupCard) {
    await groupCard.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/02-group-page.png', fullPage: true });
  }

  await browser.close();
  console.log('\nScreenshots saved to ./screenshots/');
}

takeScreenshots().catch(console.error);
