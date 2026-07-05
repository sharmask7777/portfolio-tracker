import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Font Visibility and WCAG Contrast Analysis', () => {
  test.use({ reducedMotion: 'reduce' });

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

  // OS-level prefers-reduced-motion is now handled via emulateMedia directly on the page context

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
      
      let ringColorStr = 'transparent';
      
      const getRGB = (color) => {
        if (!color) return { r: 255, g: 255, b: 255, a: 1 };
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return { 
                r: parseInt(match[1], 10), 
                g: parseInt(match[2], 10), 
                b: parseInt(match[3], 10),
                a: match[4] !== undefined ? parseFloat(match[4]) : 1
            };
        }
        // Handle hex
        const hexMatch = color.match(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16),
                a: 1
            };
        }
        return { r: 255, g: 255, b: 255, a: 1 };
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
          if(bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return getRGB(bg);
          current = current.parentNode;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };

      let bg = getBgColor(el);

      const isVisibleOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)' && style.outlineColor !== 'transparent';
      let blendedR = bg.r, blendedG = bg.g, blendedB = bg.b;
      
      if (isVisibleOutline) {
          const outline = getRGB(style.outlineColor);
          blendedR = Math.round((1 - outline.a) * bg.r + outline.a * outline.r);
          blendedG = Math.round((1 - outline.a) * bg.g + outline.a * outline.g);
          blendedB = Math.round((1 - outline.a) * bg.b + outline.a * outline.b);
          
          const l1 = luminance(blendedR, blendedG, blendedB);
          const l2 = luminance(bg.r, bg.g, bg.b);
          return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) >= 3;
      } else if (style.boxShadow && style.boxShadow !== 'none') {
          const matches = [...style.boxShadow.matchAll(/(rgba?\([^)]+\)|#[a-fA-F0-9]+)/g)];
          if (matches.length > 0) {
              const shadowColors = matches.map(m => getRGB(m[1]));
              const outerShadow = shadowColors[shadowColors.length - 1]; // Last is outer ring
              
              const outerR = Math.round((1 - outerShadow.a) * bg.r + outerShadow.a * outerShadow.r);
              const outerG = Math.round((1 - outerShadow.a) * bg.g + outerShadow.a * outerShadow.g);
              const outerB = Math.round((1 - outerShadow.a) * bg.b + outerShadow.a * outerShadow.b);
              
              const bgL = luminance(bg.r, bg.g, bg.b);
              const outerL = luminance(outerR, outerG, outerB);
              
              const outerRatio = (Math.max(outerL, bgL) + 0.05) / (Math.min(outerL, bgL) + 0.05);
              if (outerRatio < 3) return false;
              
              if (shadowColors.length > 1) {
                  const innerShadow = shadowColors[0];
                  const innerR = Math.round((1 - innerShadow.a) * outerR + innerShadow.a * innerShadow.r);
                  const innerG = Math.round((1 - innerShadow.a) * outerG + innerShadow.a * innerShadow.g);
                  const innerB = Math.round((1 - innerShadow.a) * outerB + innerShadow.a * innerShadow.b);
                  const innerL = luminance(innerR, innerG, innerB);
                  
                  const innerRatio = (Math.max(innerL, outerL) + 0.05) / (Math.min(innerL, outerL) + 0.05);
                  if (innerRatio < 3) return false;
              }
              return true;
          } else {
             return true;
          }
      } else {
          return true;
      }
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
    
    const headerLocator = page.locator('.header, header, .nav').first();
    let headerBleedValid = true;
    if (await headerLocator.isVisible()) {
        const textColor = await headerLocator.evaluate((el) => window.getComputedStyle(el).color);
        
        // Hide text content temporarily without mutating DOM layout
        await headerLocator.evaluate((el) => {
            const elements = [];
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null, false);
            elements.push(el);
            let n;
            while (n = walk.nextNode()) elements.push(n);
            
            elements.forEach(node => {
                if (node.style !== undefined) {
                    node.dataset.a11yOriginalColor = node.style.color || '';
                    node.dataset.a11yOriginalTextShadow = node.style.textShadow || '';
                    node.style.setProperty('color', 'transparent', 'important');
                    node.style.setProperty('text-shadow', 'none', 'important');
                }
            });
        });

        const screenshot = await headerLocator.screenshot();
        const base64 = screenshot.toString('base64');
        
        // Restore text color
        await headerLocator.evaluate((el) => {
            const elements = [];
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null, false);
            elements.push(el);
            let n;
            while (n = walk.nextNode()) elements.push(n);
            
            elements.forEach(node => {
                if (node.style !== undefined && node.dataset.a11yOriginalColor !== undefined) {
                    node.style.color = node.dataset.a11yOriginalColor;
                    node.style.textShadow = node.dataset.a11yOriginalTextShadow;
                    delete node.dataset.a11yOriginalColor;
                    delete node.dataset.a11yOriginalTextShadow;
                }
            });
        });

        await page.waitForTimeout(300); // Wait for transition to finish

        headerBleedValid = await page.evaluate(async ({ base64Str, textColor, dpr }) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Mathematically account for window.devicePixelRatio if doing coordinate lookups
                    canvas.width = img.width; 
                    canvas.height = img.height;
                    // Use srgb color space to avoid distortions in relative luminance math
                    const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
                    if(!ctx) return resolve(true);
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    
                    let totalR = 0, totalG = 0, totalB = 0;
                    const pixelCount = data.length / 4;
                    for (let i = 0; i < data.length; i += 4) {
                        totalR += data[i];
                        totalG += data[i+1];
                        totalB += data[i+2];
                    }
                    const avgR = totalR / pixelCount;
                    const avgG = totalG / pixelCount;
                    const avgB = totalB / pixelCount;
                    
                    const luminance = (r, g, b) => {
                        const a = [r, g, b].map(v => {
                            v /= 255;
                            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                        });
                        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
                    };
                    
                    const getRGB = (color) => {
                        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                        if(match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
                        return { r: 0, g: 0, b: 0 };
                    };
                    
                    const fg = getRGB(textColor);
                    const fgL = luminance(fg.r, fg.g, fg.b);
                    const bgL = luminance(avgR, avgG, avgB);
                    const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
                    resolve(ratio >= 4.5);
                };
                img.src = 'data:image/png;base64,' + base64Str;
            });
        }, { base64Str: base64, textColor, dpr: await page.evaluate(() => window.devicePixelRatio) });
    }
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
      await page.emulateMedia({ reducedMotion: 'reduce' });
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

  test('theme transitions should be synchronous to avoid transient contrast dips', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app');
    
    const transitionErrors = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const errs = [];
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const property = style.transitionProperty;
        if (property === 'none' || property === '') return;
        
        const props = property.split(',').map(p => p.trim());
        const durations = style.transitionDuration.split(',').map(d => d.trim());
        const easings = style.transitionTimingFunction.split(',').map(e => e.trim());
        const delays = (style.transitionDelay || '0s').split(',').map(d => d.trim());
        
        const colorIdx = props.indexOf('color');
        const bgProps = ['background-color', 'background-image', 'background', 'opacity'];
        const allIdx = props.indexOf('all');
        
        if (allIdx !== -1) return;
        
        if (colorIdx !== -1) {
           const colorDuration = durations[colorIdx];
           const colorEasing = easings[colorIdx];
           const colorDelay = delays[colorIdx] || '0s';
           
           bgProps.forEach(bgProp => {
             const bgIdx = props.indexOf(bgProp);
             if (bgIdx !== -1) {
               if (durations[bgIdx] !== colorDuration || easings[bgIdx] !== colorEasing || (delays[bgIdx] || '0s') !== colorDelay) {
                 errs.push(`Mismatched transition on ${el.tagName}: ${bgProp} vs color`);
               }
             }
           });
        } else {
           bgProps.forEach(bgProp => {
             const bgIdx = props.indexOf(bgProp);
             if (bgIdx !== -1 && durations[bgIdx] !== '0s') {
               errs.push(`Asynchronous transition on ${el.tagName}: ${bgProp} transitions but color does not.`);
             }
           });
        }
      });
      return errs;
    });
    
    expect(transitionErrors).toEqual([]);
  });
});
