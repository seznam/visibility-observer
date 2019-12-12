import insularObserverFactory from 'insular-observer'
import managedMapFactory from 'key-master'

export interface IOptions extends Omit<IntersectionObserverInit, 'root' | 'rootMargin'> {
  rootMargin?: number | string
  once?: boolean
}

interface INormalizedOptions extends Required<IOptions> {
  rootMargin: string
}

interface IObservedElementOptions extends INormalizedOptions {
  unobserve: UnobserveCallback
}

type Listener = (entry: IntersectionObserverEntry) => void
type ObserveCallback = (target: Element, listener: Listener) => UnobserveCallback
type UnobserveCallback = () => void

const observedElements = managedMapFactory(
  () => new Map<Listener, IObservedElementOptions>(),
  new WeakMap<Element, Map<Listener, IObservedElementOptions>>(),
)

/**
 * Registers the provided callback to be called whenever the specified target's visibility changes according to the
 * provided options. If the <code>once</code> options flag is <code>true</code>, the callback will be invoked only a
 * single time and only when the target begins in intersect the viewport according to the provided options.
 *
 * There can be any number of callbacks registered for every observed target, and every callback may use different
 * options. Calling <code>observe</code> with the same target, callback and equivalent options has no effect (two
 * different options objects are considered equivalent if they result in the same behavior). Calling
 * <code>observe</code> with the same target and callback but different options reconfigures how the callback will be
 * invoked.
 *
 * @param target The target which's visibility is to be observed.
 * @param callback The callback to call whenever the visibility of the target changes.
 * @param options The options configuring the target's visibility observing behavior. These options are passed to the
 *        underlying <code>IntersectionObserver</code>. Note that the <code>IntersectionObserver</code>'s
 *        <code>root</code> option is ignored.
 */
export function observe<E extends Element>(
  target: E,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
  options: IOptions = {},
): void {
  const normalizedOptions = normalizeOptions(options)
  const elementCallbacks = observedElements.get(target)
  const existingConfiguration = elementCallbacks.get(callback)
  if (existingConfiguration) {
    if (areOptionsEqual(normalizedOptions, existingConfiguration)) {
      return
    }

    unobserve(target, callback)
  }

  const observeElement = getObserver(normalizedOptions)
  const unobserveCallback = observeElement(target, options.once ? onceObserver.bind(null, callback) : callback)
  elementCallbacks.set(callback, {
    ...normalizedOptions,
    unobserve: unobserveCallback,
  })
}

/**
 * Stops reporting the visibility changes for the specified target to the specified callback. Visibility changes will
 * still be reported to any other callbacks registered for the target.
 *
 * Calling this function for a target that is not being observed or a callback that is not currently registered with the
 * target has not effect.
 *
 * @param target The target which's visibility is observed.
 * @param callback The callback that should no longer be called when the target's visibility changes.
 */
export function unobserve(
  target: Element,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
): void {
  const elementCallbacks = observedElements.getUnderlyingDataStructure().get(target)
  if (elementCallbacks) {
    const options = elementCallbacks.get(callback)
    if (options) {
      options.unobserve()
      elementCallbacks.delete(callback)
      if (!elementCallbacks.size) {
        observedElements.delete(target)
      }
    }
  }
}

/**
 * Performs equality checks for the provided options objects.
 *
 * @param options1 The first options object.
 * @param options2 The second options object.
 * @return <code>true</code> iff the options objects are considered strictly equal to each other.
 */
function areOptionsEqual(options1: INormalizedOptions, options2: INormalizedOptions): boolean {
  return (
    options1.rootMargin === options2.rootMargin &&
    options1.threshold === options2.threshold &&
    options1.once === options2.once
  )
}

/**
 * Wrapper for a listener callback used to make the provided callback being executed only once when the observed
 * element becomes visible and then being unregistered.
 *
 * This function is not meant to be used on it's own, it's expected to be bound to the actual callback to invoke and
 * then passed to the underlying observer.
 *
 * @param callback The callback to execute once the observed element is visible and should no longer be executed after
 *        that.
 * @param entry The observer's entry, provided by the observer when a change to the element's visibility is detected.
 */
function onceObserver(callback: Listener, entry: IntersectionObserverEntry): void {
  if (entry.isIntersecting) {
    unobserve(entry.target, callback)
    callback(entry)
  }
}

/**
 * Returns the insular observer to use for the provided options. The options are used as cache keys to re-use the
 * existing observers as much as possible.
 *
 * @param options The observer options, configuring its behavior.
 * @return The observer to use with the provided options.
 */
const getObserver = (() => {
  const observers = new Map<string, ObserveCallback>()

  return (options: INormalizedOptions): ObserveCallback => {
    const serializedOptions = `${options.rootMargin};${options.threshold};${options.once}`
    const observer = observers.get(serializedOptions)
    if (observer) {
      return observer
    }

    const newObserver = insularObserverFactory(IntersectionObserver, options)
    observers.set(serializedOptions, newObserver)
    return newObserver
  }
})()

/**
 * Normalizes the provided options by filling in the default values where needed and expanding any shorthands,
 * simplifying the usage, especially for use with caching and comparison.
 *
 * @param options The options to normalize
 * @return Normalized options, with defaults set for any missing values and all short-hands expanded to full forms.
 */
function normalizeOptions({once, rootMargin, threshold}: IOptions): INormalizedOptions {
  return {
    once: !!once,
    rootMargin: normalizeRootMargin(typeof rootMargin !== 'undefined' ? rootMargin : '0px 0px 0px 0px'),
    threshold: typeof threshold !== 'undefined' ? threshold : 0,
  }
}

/**
 * Normalizes the provided rootMargin option to a CSS-compatible string specifying margin for every edge separately
 * (i.e. expanding any short-hand notation to the full form).
 *
 * @param rootMargin The root margin option value to normalize.
 * @return Normalized root margin with any short-hand notation expanded to the full form.
 */
function normalizeRootMargin(rootMargin: number | string): string {
  const parts = (typeof rootMargin === 'number' ? `${rootMargin}px` : rootMargin).trim().split(/\s+/)
  if (parts.length > 4) {
    throw new TypeError(
      'Invalid root margin, expected a single number or a string containing 1 to 4 numbers suffixed by "px" or "%" ' +
      `and separated by whitespace: ${rootMargin}`,
    )
  }
  if (parts.length === 1) {
    parts.push(parts[0])
  }
  if (parts.length === 2) {
    parts.push(parts[0])
  }
  if (parts.length === 3) {
    parts.push(parts[1])
  }
  return parts.join(' ')
}
