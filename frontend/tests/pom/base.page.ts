import { Page } from '@playwright/test';

export interface BasePageOptions {
  /**
   * If true (default), unhandled page errors caught via page.on('pageerror')
   * will log stack trace and immediately throw an error failing the test.
   */
  failOnPageError?: boolean;
}

export interface AttachedErrorListener {
  errors: Error[];
  detach: () => void;
}

/**
 * Attach unhandled page error listener to page so browser runtime exceptions
 * fail tests immediately with stack traces.
 */
export function attachPageErrorListener(
  page: Page,
  options: BasePageOptions = {}
): AttachedErrorListener {
  const pageAny = page as any;
  const failOnPageError = options.failOnPageError ?? true;

  if (pageAny.__pageErrorListenerAttached) {
    return {
      errors: pageAny.__capturedPageErrors || [],
      detach: pageAny.__detachPageErrorListener || (() => {}),
    };
  }

  const errors: Error[] = [];
  pageAny.__pageErrorListenerAttached = true;
  pageAny.__capturedPageErrors = errors;

  const listener = (exception: Error) => {
    errors.push(exception);
    console.error(
      `\n❌ [Playwright Browser Runtime Error] ${exception.name}: ${exception.message}\n` +
      `Stack Trace:\n${exception.stack || 'No stack trace available'}\n`
    );
    if (failOnPageError) {
      throw new Error(
        `Unhandled browser page error: ${exception.message}\n${exception.stack || 'No stack trace'}`
      );
    }
  };

  page.on('pageerror', listener);

  const detach = () => {
    page.off('pageerror', listener);
    pageAny.__pageErrorListenerAttached = false;
  };

  pageAny.__detachPageErrorListener = detach;

  return { errors, detach };
}

/**
 * Base Page Object Model class providing page-error listener lifecycle
 * and common assertions.
 */
export class BasePage {
  readonly page: Page;
  readonly pageErrors: Error[];
  private detachListener: () => void;

  constructor(page: Page, options: BasePageOptions = {}) {
    this.page = page;
    const { errors, detach } = attachPageErrorListener(page, options);
    this.pageErrors = errors;
    this.detachListener = detach;
  }

  /**
   * Asserts that no unhandled browser exceptions occurred during page interaction.
   */
  assertNoPageErrors(): void {
    if (this.pageErrors.length > 0) {
      const summary = this.pageErrors
        .map(e => `${e.name}: ${e.message}\n${e.stack || 'No stack'}`)
        .join('\n---\n');
      throw new Error(`Expected zero unhandled browser page errors, but found ${this.pageErrors.length}:\n${summary}`);
    }
  }

  /**
   * Returns list of captured unhandled browser errors.
   */
  getPageErrors(): Error[] {
    return [...this.pageErrors];
  }

  /**
   * Cleans up listener if needed.
   */
  cleanup(): void {
    this.detachListener();
  }
}
