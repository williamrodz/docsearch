import puppeteer from 'puppeteer';

async function takeScreenshots() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport for desktop
  await page.setViewport({ width: 1280, height: 800 });

  console.log('1. Taking screenshot of home page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

  console.log('2. Taking screenshot of new group page...');
  await page.goto('http://localhost:3000/groups/new', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: 'screenshots/02-new-group.png', fullPage: true });

  // Create a user first
  console.log('3. Creating a test user...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  // Click user dropdown
  const userButton = await page.waitForSelector('button:has(svg)', { timeout: 5000 });
  if (userButton) {
    // Find the user switcher button (last button in header)
    const buttons = await page.$$('header button');
    if (buttons.length > 0) {
      await buttons[buttons.length - 1].click();
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: 'screenshots/03-user-menu.png' });
    }
  }

  await browser.close();
  console.log('\nScreenshots saved to ./screenshots/');
}

takeScreenshots().catch(console.error);
