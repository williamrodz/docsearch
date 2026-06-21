import puppeteer from 'puppeteer';

async function takeScreenshots() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport for desktop
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Taking screenshot of home page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

  console.log('Taking screenshot of new group page...');
  await page.goto('http://localhost:3000/groups/new', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshots/02-new-group.png', fullPage: true });

  // Test user switcher
  console.log('Testing user switcher...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Click user switcher button
  const userButton = await page.$('button:has-text("Select User"), button:has-text("Loading")');
  if (userButton) {
    await userButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/03-user-dropdown.png', fullPage: true });
  }

  await browser.close();
  console.log('\nScreenshots saved to ./screenshots/');
}

takeScreenshots().catch(console.error);
