// tslint:disable max-classes-per-file

// import {observe, unobserve} from '../index'

describe('visibility observer', () => {
  interface IExposedIntersectionObserver extends IntersectionObserver {
    readonly targets: ReadonlyArray<Element>
  }

  const intersectionObservers: Array<[IExposedIntersectionObserver, IntersectionObserverCallback]> = []

  beforeAll(() => {
    if (!window.DOMRectReadOnly) {
      window.DOMRectReadOnly = class DOMRectReadOnly {
        public static fromRect(other?: DOMRectInit): DOMRectReadOnly {
          const init = other || {}
          return new DOMRectReadOnly(init.x, init.y, init.width, init.height)
        }

        public readonly bottom: number
        public readonly height: number
        public readonly left: number
        public readonly right: number
        public readonly top: number
        public readonly width: number
        public readonly x: number
        public readonly y: number

        constructor(x?: number, y?: number, width?: number, height?: number) {
          this.x = x || 0
          this.y = y || 0
          this.width = width || 0
          this.height = height || 0
          this.left = this.x
          this.top = this.y
          this.right = this.x + this.width
          this.bottom = this.y + this.height
        }

        public toJSON(): any {
          return Object.assign({}, this)
        }
      }
    }

    if (!window.IntersectionObserverEntry) {
      window.IntersectionObserverEntry = class IntersectionObserverEntry {
        public readonly boundingClientRect: DOMRectReadOnly
        public readonly intersectionRatio: number
        public readonly intersectionRect: DOMRectReadOnly
        public readonly isIntersecting: boolean
        public readonly rootBounds: DOMRectReadOnly | null
        public readonly target: Element
        public readonly time: number

        constructor(init: IntersectionObserverEntryInit) {
          this.boundingClientRect = DOMRectReadOnly.fromRect(init.boundingClientRect)
          this.intersectionRatio = init.intersectionRatio
          this.intersectionRect = DOMRectReadOnly.fromRect(init.intersectionRect)
          this.isIntersecting = init.isIntersecting
          this.rootBounds = DOMRectReadOnly.fromRect(init.rootBounds || undefined)
          this.target = init.target
          this.time = init.time
        }
      }
    }

    window.IntersectionObserver = class IntersectionObserver {
      public readonly root: Element | null
      public readonly rootMargin: string
      public readonly thresholds: ReadonlyArray<number>
      public readonly targets: Element[] = []

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        const currentOptions = options || {}
        this.root = currentOptions.root || null
        this.rootMargin = currentOptions.rootMargin || '0px 0px 0px 0px'
        this.thresholds = typeof currentOptions.threshold === 'number' ?
          [currentOptions.threshold]
        :
          currentOptions.threshold || [0]

        intersectionObservers.push([this, callback])
      }

      public disconnect(): void {
        this.targets.splice(0)
      }

      public observe(target: Element): void {
        if (!this.targets.includes(target)) {
          this.targets.push(target)
        }
      }

      public takeRecords(): IntersectionObserverEntry[] {
        return []
      }

      public unobserve(target: Element): void {
        const index = this.targets.indexOf(target)
        if (index > -1) {
          this.targets.splice(index, 1)
        }
      }
    }
  })

  it('registers the provided target with an intersection observer', () => {})

  it('normalizes the intersection observer options', () => {})

  it('does not pass the root option to the intersection observer', () => {})

  it('reuses intersection observers for the same options', () => {})

  it('invokes the correct callback when visibility of a target changes', () => {})

  it('allows registration of multiple callbacks for the same target', () => {})

  it('stops firing the callback for the given target after calling unobserve', () => {})

  it('support registering a one-off callbacks using the once option', () => {})

  it('does not call the callback if the target is not visible when the once flag is set', () => {})

  it('switches observers when calling observe again with the options modified', () => {})

  it('has no effect when calling observe with equivalent arguments or equal', () => {})

  it('has no effect when calling unobserve for unused callback', () => {})

  it('has no effect when calling unobserve for target that is not observed', () => {})

  afterEach(() => {
    intersectionObservers.splice(0)
  })

  function fireIntersection(
    isIntersecting: boolean,
    ratio: number,
    callback?: IntersectionObserverCallback,
    target?: Element,
  ): void {
    const observerCallback = callback || intersectionObservers[intersectionObservers.length - 1][1]
    if (!observerCallback) {
      throw new Error(`There are no known intersection observers`)
    }

    const observerInfo = intersectionObservers.find(
      ([, intersectionCallback]) => intersectionCallback === observerCallback,
    )
    if (!observerInfo) {
      throw new Error(`There is no known observer for the specified callback`)
    }

    const targets = target ? [target] : observerInfo[0].targets
    const entries = targets.map((currentTarget) => createIntersectionEntry(currentTarget, isIntersecting, ratio))
    observerCallback(entries, observerInfo[0])
  }

  function createIntersectionEntry(target: Element, isIntersecting: boolean, ratio: number): IntersectionObserverEntry {
    return new IntersectionObserverEntry({
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRatio: ratio,
      intersectionRect: {},
      isIntersecting,
      rootBounds: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
      target,
      time: performance.now(),
    })
  }
})
