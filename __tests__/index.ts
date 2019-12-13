// tslint:disable max-classes-per-file

import {IOptions, observe, unobserve} from '../dist/index'

describe('visibility observer', () => {
  interface IExposedIntersectionObserver extends IntersectionObserver {
    readonly targets: ReadonlyArray<Element>
  }

  const intersectionObservers: Array<[IExposedIntersectionObserver, IntersectionObserverCallback]> = []
  let onceFlagValueTest: null | ((value: any) => void) = null

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
        expect(typeof (currentOptions as any).once).toBe('boolean')
        if (onceFlagValueTest) {
          onceFlagValueTest((currentOptions as any).once)
          onceFlagValueTest = null
        }

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

  it('registers the provided target with an intersection observer', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const callback = jest.fn()
    observe(target, callback)
    expect(intersectionObservers.length).toBe(1)
    const observer = intersectionObservers[0][0]
    expect(observer.targets).toEqual([target])
  })

  it('normalizes the intersection observer options', () => {
    observe(document.body.appendChild(document.createElement('div')), jest.fn())
    const observer1 = lastItem(intersectionObservers)[0]
    expect(observer1.thresholds).toEqual([0])
    expect(observer1.rootMargin).toBe('0px 0px 0px 0px')
    expect(observer1.root).toBeNull()

    const randomThreshold1 = Math.random()
    observe(document.body.appendChild(document.createElement('div')), jest.fn(), {
      once: false,
      rootMargin: '10% -15px 0px',
      threshold: randomThreshold1,
    })
    const observer2 = lastItem((intersectionObservers))[0]
    expect(observer2.thresholds).toEqual([randomThreshold1])
    expect(observer2.rootMargin).toBe('10% -15px 0px -15px')
    expect(observer2.root).toBeNull()

    const randomThreshold2 = Math.random()
    observe(document.body.lastElementChild!, jest.fn(), {
      rootMargin: '1px 2px',
      threshold: [randomThreshold1, randomThreshold2],
    })
    const observer3 = lastItem(intersectionObservers)[0]
    expect(observer3.thresholds).toEqual([randomThreshold1, randomThreshold2])
    expect(observer3.rootMargin).toBe('1px 2px 1px 2px')
    expect(observer3.root).toBeNull()

    observe(document.body.lastElementChild!, jest.fn(), {
      rootMargin: '-33%',
    })
    const observer4 = lastItem(intersectionObservers)[0]
    expect(observer4.rootMargin).toBe('-33% -33% -33% -33%')

    observe(document.body.lastElementChild!, jest.fn(), {
      rootMargin: 42,
    })
    const observer5 = lastItem(intersectionObservers)[0]
    expect(observer5.rootMargin).toBe('42px 42px 42px 42px')
  })

  it('does not pass the root option to the intersection observer', () => {
    const uniqueThreshold = 1 + Math.random()
    observe(document.body.appendChild(document.createElement('div')), jest.fn(), {
      root: document.body,
      threshold: uniqueThreshold,
    } as IOptions)
    const observer = lastItem(intersectionObservers)[0]
    expect(observer.root).toBeNull()
  })

  it('reuses intersection observers for the same options', () => {
    const threshold = 2 + Math.random()
    observe(document.body.appendChild(document.createElement('div')), jest.fn(), {
      threshold,
    })
    const observer1 = lastItem(intersectionObservers)
    observe(document.body.appendChild(document.createElement('div')), jest.fn(), {
      threshold,
    })
    const observer2 = lastItem(intersectionObservers)
    expect(observer1).toBe(observer2)
  })

  it('invokes the correct callback when visibility of a target changes', () => {
    const target1 = document.body.appendChild(document.createElement('div'))
    const target2 = document.body.appendChild(document.createElement('div'))
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const callback3 = jest.fn()
    const threshold1 = 3 + Math.random()
    const threshold2 = 4 + Math.random()
    observe(target1, callback1, {threshold: threshold1})
    observe(target2, callback2, {threshold: threshold1})
    observe(target2, callback3, {threshold: threshold2})
    const [[, observerCallback1], [, observerCallback2]] = intersectionObservers.slice(-2)

    fireIntersection(true, 1, observerCallback1, target1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback1.mock.calls[0].length).toBe(1)
    expect(callback1.mock.calls[0][0] instanceof IntersectionObserverEntry).toBe(true)
    expect(callback2).not.toHaveBeenCalled()
    expect(callback3).not.toHaveBeenCalled()

    fireIntersection(true, 1, observerCallback1, target2)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).not.toHaveBeenCalled()

    fireIntersection(true, 1, observerCallback2, target2)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
  })

  it('allows registration of multiple callbacks for the same target', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const threshold = 5 + Math.random()
    observe(target, callback1, {threshold})
    observe(target, callback2, {threshold})
    fireIntersection(true, 1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenLastCalledWith(...callback1.mock.calls[0])
  })

  it('stops firing the callback for the given target after calling unobserve', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 6 + Math.random()
    observe(target, callback, {threshold})
    fireIntersection(true, 1)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(2)
    unobserve(target, callback)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('support registering a one-off callbacks using the once option', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 7 + Math.random()
    observe(target, callback, {
      once: true,
      threshold,
    })
    fireIntersection(true, 1)
    fireIntersection(true, 1)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call the callback if the target is not visible when the once flag is set', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 8 + Math.random()
    observe(target, callback, {
      once: true,
      threshold,
    })
    fireIntersection(false, 0)
    fireIntersection(false, 0.5)
    fireIntersection(false, 9)
    expect(callback).not.toHaveBeenCalled()
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('switches observers when calling observe again with the options modified', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold1 = 9 + Math.random()
    const threshold2 = 10 + Math.random()
    observe(target, callback, {threshold: threshold1})
    const [originalObserver] = lastItem(intersectionObservers)
    expect(originalObserver.targets.includes(target)).toBe(true)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
    observe(target, callback, {threshold: threshold2})
    const [[observer1, observerCallback1], [observer2, observerCallback2]] = intersectionObservers.slice(-2)
    expect(observer1).toBe(originalObserver)
    expect(observer1.targets.includes(target)).toBe(false)
    expect(observer2.targets.includes(target)).toBe(true)
    fireIntersection(true, 1, observerCallback1)
    expect(callback).toHaveBeenCalledTimes(1)
    fireIntersection(true, 1, observerCallback2)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('has no effect when calling observe with equivalent arguments or equal', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 11 + Math.random()
    const initialOptions: IOptions = {
      rootMargin: '121px 121px 121px 121px',
      threshold,
    }
    observe(target, callback, initialOptions)
    const observerCount = intersectionObservers.length
    observe(target, callback, initialOptions)
    observe(target, callback, {...initialOptions})
    observe(target, callback, {
      ...initialOptions,
      once: false,
    })
    observe(target, callback, {
      ...initialOptions,
      rootMargin: '121px 121px 121px',
    })
    observe(target, callback, {
      ...initialOptions,
      rootMargin: '121px 121px',
    })
    observe(target, callback, {
      ...initialOptions,
      rootMargin: '  121px  121px   ',
    })
    observe(target, callback, {
      ...initialOptions,
      rootMargin: '121px',
    })
    observe(target, callback, {
      ...initialOptions,
      rootMargin: 121,
    })
    expect(intersectionObservers.length).toBe(observerCount)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
    observe(target, callback, {
      ...initialOptions,
      rootMargin: 122,
    })
    expect(intersectionObservers.length).toBe(observerCount + 1)
  })

  it('has no effect when calling unobserve for unused callback', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const threshold = 12 + Math.random()
    observe(target, callback1, {threshold})
    unobserve(target, callback2)
    fireIntersection(true, 1)
    expect(callback1).toHaveBeenCalledTimes(1)
  })

  it('has no effect when calling unobserve for target that is not observed', () => {
    const target1 = document.body.appendChild(document.createElement('div'))
    const target2 = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 13 + Math.random()
    observe(target1, callback, {threshold})
    unobserve(target2, callback)
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('must not change the used observer for changing the once flag in options', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 14 + Math.random()
    observe(target, callback, {threshold})
    const observersCount = intersectionObservers.length
    observe(target, callback, {
      once: false,
      threshold,
    })
    observe(target, callback, {
      once: true,
      threshold,
    })
    expect(intersectionObservers.length).toBe(observersCount)
  })

  it('must register/deregister the callback correctly when changing the once flag in options', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 15 + Math.random()
    observe(target, callback, {
      once: false,
      threshold,
    })
    observe(target, callback, {
      once: true,
      threshold,
    })
    observe(target, callback, {
      once: false,
      threshold,
    })
    fireIntersection(true, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid rootMargin option value', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    expect(() => {
      observe(target, callback, {
        rootMargin: '10 px 10px 10px 10px',
      })
    }).toThrowError(TypeError)
    try {
      observe(target, callback, {
        rootMargin: '0px 0px 0px 0px 0px',
      })
      throw new Error('This should have failed')
    } catch (error) {
      expect(error.message).toMatch('Invalid root margin')
      expect(error.message).toMatch('0px 0px 0px 0px 0px')
    }
  })

  it('normalizes the once flag correctly', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback = jest.fn()
    const threshold = 16 + Math.random()
    onceFlagValueTest = (value) => {
      expect(value).toBe(false)
    }
    observe(target, callback, {
      threshold,
    })
    onceFlagValueTest = (value) => {
      expect(value).toBe(true)
    }
    observe(target, callback, {
      once: true,
      threshold,
    })
    onceFlagValueTest = (value) => {
      expect(value).toBe(false)
    }
    observe(target, callback, {
      once: false,
      threshold,
    })
  })

  it('must return a callback for stopping the observation from the fhe observe function', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const threshold = 17 + Math.random()
    const unobserveCallback1 = observe(target, callback1, {threshold})
    const unobserveCallback2 = observe(target, callback2, {threshold})
    expect(typeof unobserveCallback1).toBe('function')
    expect(typeof unobserveCallback2).toBe('function')
    fireIntersection(true, 1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)

    unobserveCallback1()
    fireIntersection(true, 1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(2)

    unobserveCallback2()
    fireIntersection(true, 1)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(2)
  })

  function fireIntersection(
    isIntersecting: boolean,
    ratio: number,
    callback?: IntersectionObserverCallback,
    target?: Element,
  ): void {
    const observerCallback = callback || lastItem(intersectionObservers)[1]
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

  function lastItem<T>(array: readonly T[]): T {
    if (!array.length) {
      throw new Error('The provided array is empty')
    }

    return array[array.length - 1]
  }
})
