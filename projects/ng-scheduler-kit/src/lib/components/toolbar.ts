import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SchedulerHeaderToolbar } from '../core/models';
import { SchedulerStore } from '../state/scheduler-store';

type Item = { kind: 'prev' | 'next' | 'today' | 'title' } | { kind: 'views'; types: string[] };
type Section = Item[][]; // groups of items

const DEFAULT_TOOLBAR: Required<SchedulerHeaderToolbar> = { left: 'prev,next today', center: 'title', right: 'month,week,day' };

/**
 * Toolbar driven by `headerToolbar` (`{ left, center, right }`). Tokens: `prev`, `next`, `today`,
 * `title` and view names; commas join items into a group, spaces separate groups.
 * Consecutive view names become one view switcher (dropdown by default).
 */
@Component({
  selector: 'sch-scheduler-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sch-toolbar' },
  template: `
    @for (section of sections(); track $index; let si = $index) {
      <div class="sch-toolbar__section" [class]="sectionClass[si]">
        @if (si === 2) {
          <ng-content />
        }
        @for (group of section; track $index) {
          <div class="sch-toolbar__group">
            @for (item of group; track $index) {
              @switch (item.kind) {
                @case ('prev') {
                  <button type="button" class="sch-icon-btn" [disabled]="!store.canNavigate(-1)" [attr.aria-label]="store.label('prev')" (click)="store.prev()">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
                  </button>
                }
                @case ('next') {
                  <button type="button" class="sch-icon-btn" [disabled]="!store.canNavigate(1)" [attr.aria-label]="store.label('next')" (click)="store.next()">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
                  </button>
                }
                @case ('today') {
                  <button type="button" class="sch-link-btn" (click)="store.today()">{{ store.label('today') }}</button>
                }
                @case ('title') {
                  <h2 class="sch-toolbar__title" aria-live="polite">{{ store.title() }}</h2>
                }
                @case ('views') {
                  @if (asViews(item); as types) {
                    @if (switcher() === 'select') {
                      <label class="sch-select">
                        <span class="sch-visually-hidden">{{ store.label('view') }}</span>
                        <select (change)="store.setView($any($event.target).value)">
                          @for (t of types; track t) {
                            <option [value]="t" [selected]="t === store.view()">{{ store.label(t) }}</option>
                          }
                        </select>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                      </label>
                    } @else {
                      <div class="sch-segmented" role="group" [attr.aria-label]="store.label('views')">
                        @for (t of types; track t) {
                          <button
                            type="button"
                            class="sch-segmented__item"
                            [class.sch-is-active]="t === store.view()"
                            [attr.aria-pressed]="t === store.view()"
                            (click)="store.setView(t)"
                          >
                            {{ store.label(t) }}
                          </button>
                        }
                      </div>
                    }
                  }
                }
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class SchSchedulerToolbar {
  protected readonly store = inject(SchedulerStore);
  /** `'select'` dropdown (default) or `'buttons'` segmented control for view names. */
  readonly switcher = input<'select' | 'buttons'>('select');

  protected readonly sectionClass = ['sch-toolbar__start', 'sch-toolbar__center', 'sch-toolbar__end'];

  protected readonly sections = computed<Section[]>(() => {
    const cfg = this.store.headerToolbar() || DEFAULT_TOOLBAR;
    // Only views that are registered (and allowed by the `views` input) are shown.
    const available = new Set(this.store.views().map((v) => v.type));
    return [cfg.left ?? '', cfg.center ?? '', cfg.right ?? ''].map((spec) => this.parse(spec, available));
  });

  private parse(spec: string, available: Set<string>): Section {
    const groups: Section = [];
    for (const groupSpec of spec.trim().split(/\s+/).filter(Boolean)) {
      const group: Item[] = [];
      let views: string[] = [];
      const flush = () => {
        if (views.length) group.push({ kind: 'views', types: views });
        views = [];
      };
      for (const token of groupSpec.split(',').map((t) => t.trim()).filter(Boolean)) {
        if (token === 'prev' || token === 'next' || token === 'today' || token === 'title') {
          flush();
          group.push({ kind: token });
        } else if (available.has(token)) {
          views.push(token);
        }
      }
      flush();
      // A switcher with a single view is pointless.
      const cleaned = group.filter((i) => i.kind !== 'views' || i.types.length > 1);
      if (cleaned.length) groups.push(cleaned);
    }
    return groups;
  }

  protected asViews(item: Item): string[] | null {
    return item.kind === 'views' ? item.types : null;
  }
}
