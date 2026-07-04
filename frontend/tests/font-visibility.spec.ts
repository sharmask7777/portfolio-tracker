import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Font Visibility and WCAG Contrast Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock fully populated state for testing
    await page.route('**/api/portfolio/summary*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-portfolio',
          metrics: { totalValue: 120000, totalInvested: 90000, totalReturns: 30000, xirr: 15 },
          folios: [
            {
              id: 'f1',
              asset: { name: 'Growth Fund', type: 'EQUITY_MF' },
              metrics: { investedAmount: 50000, currentValue: 70000, dayChange: 500, dayChangePercentage: 0.7, xirr: 20, absoluteReturn: 0.4, postTaxXirr: 18, postTaxAbsoluteReturn: 0.35 }
            },
            {
              id: 'f2',
              asset: { name: 'Value Fund', type: 'DEBT_MF' },
              metrics: { investedAmount: 40000, currentValue: 50000, dayChange: -200, dayChangePercentage: -0.4, xirr: -5, absoluteReturn: -0.1, postTaxXirr: -4, postTaxAbsoluteReturn: -0.08 }
            }
          ],
          taxSlab: 0.3
        })
      });
    });

    await page.route('**/api/portfolio/*/xray', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ capAllocation: { large: 50, mid: 30, small: 20 } })
      });
    });

    await page.route('**/api/portfolio/*/exposures', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'Reliance Industries', percentage: 0.05, contributions: [{ schemeName: "Growth Fund", weight: 5 }] }])
      });
    });

    await page.route('**/api/portfolio/*/tax-summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          ltcg: 1000, 
          stcg: 500, 
          estimatedTax: 150, 
          details: [{ sellDate: '2024-05-01T00:00:00Z', type: 'LTCG', gain: 1000 }] 
        })
      });
    });

    await page.route('**/api/tax/harvesting-opportunities*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ opportunities: [{ folioId: 'f1', amount: 1000, schemeName: "Growth Fund", unitsToHarvest: 100 }] })
      });
    });

    await page.route('**/api/family/profiles', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'mock-profile', name: 'Test User', taxSlab: 0.3 }])
      });
    });
  });

  const waitForStableDOM = async (page) => {
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      return document.getAnimations().length === 0;
    });
  };

  const analyzeContrast = async (page) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .analyze();
    return accessibilityScanResults.violations.filter(v => v.id === 'color-contrast');
  };

  test('should pass WCAG color contrast tests in light mode across views and interactions', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForSelector('.app');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await waitForStableDOM(page);

    // Initial Overview tab
    let contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    // Hover over elements
    await page.hover('button:has-text("Import CAS")');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    // Focus indicators (non-text contrast check for WCAG 2.1)
    await page.focus('button.theme-toggle');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    // Manually check focus indicator outline contrast (WCAG 1.4.11)
    const focusContrastValid = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return true;
      const style = window.getComputedStyle(el);
      const outlineColor = style.outlineColor;
      if (outlineColor === 'rgba(0, 0, 0, 0)' || outlineColor === 'transparent') return true;
      
      const getRGB = (color) => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)] : [255, 255, 255];
      };
      
      const luminance = (r, g, b) => {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };
      
      const getBgColor = (node) => {
        let current = node;
        while(current && current.nodeType === 1) {
          const bg = window.getComputedStyle(current).backgroundColor;
          if(bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          current = current.parentNode;
        }
        return 'rgb(255, 255, 255)';
      };
      
      const l1 = luminance(...getRGB(outlineColor));
      const l2 = luminance(...getRGB(getBgColor(el)));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return ratio >= 3;
    });
    expect(focusContrastValid).toBe(true);

    // Hover over table rows
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.hover();
      await waitForStableDOM(page);
      contrastViolations = await analyzeContrast(page);
      expect(contrastViolations).toEqual([]);
    }

    // Scroll States and Sticky Elements
    await page.evaluate(() => window.scrollBy(0, 500));
    await waitForStableDOM(page);
    
    // Explicitly assert sticky header bleed-through testing gap
    const headerBleedValid = await page.evaluate(() => {
      const header = document.querySelector('.header') || document.querySelector('header') || document.querySelector('.nav');
      if (!header) return true;
      const style = window.getComputedStyle(header);
      const isSticky = style.position === 'sticky' || style.position === 'fixed';
      if (!isSticky) return true;
      
      const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
      const hasBackdrop = style.backdropFilter && style.backdropFilter !== 'none';
      const opacity = parseFloat(style.opacity);
      
      return opacity >= 0.9 && (hasBg || hasBackdrop);
    });
    expect(headerBleedValid).toBe(true);
    
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    // Modals and transient states
    await page.click('button:has-text("Add Other Asset")');
    await page.waitForSelector('.modal');
    await waitForStableDOM(page);
    
    // Focus form inputs in modal
    const input = page.locator('.modal input').first();
    if (await input.isVisible()) {
      await input.focus();
      await waitForStableDOM(page);
      contrastViolations = await analyzeContrast(page);
      expect(contrastViolations).toEqual([]);

      const saveBtn = page.locator('.modal button:has-text("Save"), .modal button:has-text("Submit")');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await waitForStableDOM(page);
        // Axe check while error validation or transient toast is displayed
        contrastViolations = await analyzeContrast(page);
        expect(contrastViolations).toEqual([]);
      }
    }
    
    await page.evaluate(() => document.querySelector('.modal button')?.click());
    await waitForStableDOM(page);
    
    // Core Tabs: X-Ray
    await page.click('text=Portfolio X-Ray');
    await waitForStableDOM(page);
    
    // Chart tooltip positioning edge cases
    const chartDataPoint = page.locator('.recharts-layer path, .recharts-layer rect, .recharts-pie-sector, .recharts-bar-rectangle').first();
    if (await chartDataPoint.isVisible()) {
      await chartDataPoint.hover({ force: true });
      await page.waitForSelector('.recharts-tooltip-wrapper', { state: 'visible', timeout: 5000 }).catch(() => {});
      await waitForStableDOM(page);
    }
    
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    // Core Tabs: Exposures
    await page.click('text=Stock Intersection');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    await page.click('text=Tax Optimization');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);
  });

  test('should pass WCAG color contrast tests in dark mode across views and interactions', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.app');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await waitForStableDOM(page);

    let contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    await page.click('text=Portfolio X-Ray');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    await page.click('text=Stock Intersection');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    await page.click('text=Overview');
    await waitForStableDOM(page);
    await page.click('button:has-text("Add Other Asset")');
    await page.waitForSelector('.modal');
    await waitForStableDOM(page);
    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);
  });

  test('should pass WCAG color contrast tests when system theme and local theme conflict', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.app');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await waitForStableDOM(page);

    let contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await waitForStableDOM(page);

    contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);
  });

  test('should pass WCAG color contrast tests in high contrast mode / forced colors', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active', contrast: 'more' });
    await page.goto('/');
    await page.waitForSelector('.app');
    await waitForStableDOM(page);

    let contrastViolations = await analyzeContrast(page);
    expect(contrastViolations).toEqual([]);
  });
});
