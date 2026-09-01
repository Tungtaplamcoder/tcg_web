import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * BreadcrumbBar — subtle, theme-aware navigation trail.
 * Items: [{ label, to? }] — last item renders as the current page
 * (non-clickable, highlighted) with a soft gradient underline.
 */
const BreadcrumbBar = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium">
        <li className="flex items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted transition-colors duration-200 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-400/10"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <React.Fragment key={`${item.label}-${i}`}>
              <li aria-hidden="true" className="text-faint">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="flex items-center">
                {isLast || !item.to ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={`max-w-[42vw] truncate rounded-lg px-2 py-1 sm:max-w-none ${
                      isLast
                        ? 'font-semibold text-gradient-brand'
                        : 'text-muted'
                    }`}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    className="max-w-[42vw] truncate rounded-lg px-2 py-1 text-muted transition-colors duration-200 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-400/10 sm:max-w-none"
                    title={item.label}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadcrumbBar;
