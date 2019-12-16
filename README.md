# visibility-observer

[![Build Status](https://travis-ci.org/seznam/visibility-observer.svg?branch=master)](https://travis-ci.org/seznam/visibility-observer)
[![npm](https://img.shields.io/npm/v/@seznam/visibility-observer.svg)](https://www.npmjs.com/package/@seznam/visibility-observer)
[![License](https://img.shields.io/npm/l/@seznam/visibility-observer.svg)](LICENSE)
![npm type definitions](https://img.shields.io/npm/types/@seznam/visibility-observer.svg)

Helper making the observation of element's visibility a little more convenient.
Based on the IntersectionObserver API.

The visibility observer helper smartly caches the used intersection observers,
optimizing the performance of your code while providing a more convenient API.

## Installation

```
npm install --save @seznam/visibility-observer
```

## Usage

The following snippet shows a basic usage example:

```typescript
import {observe, unobserve} from '@seznam/visibility-observer'

const imageSource = 'https://example.com/image.png'
const image = document.getElementById('pic') as HTMLImageElement

observe(image, onVisibilityChange, {
  // The optional configuration object accepts all the options of the
  // IntersectionObserver's constructor except for the root option (the
  // observed element's visibility is always watched relative to the
  // viewport).

  // CSS-like string representing the margins considered around the viewport
  // when determining whether the observed element is intersecting it. All
  // CSS shorthand notations are accepted. The observe function also supports
  // a single number for this option, which represents an equally large margin
  // width for all edges in pixels. This option default to '0px'.
  rootMargin: 16, // equivalent to '16px 16px 16px 16px',

  // A number or a an array of numbers in range [0, 1]. When the element's
  // visibility ratio crosses any of the specified thresholds either way, the
  // provided callback will be called. This option defaults to 0.
  threshold: 0.5,

  // Unlike the IntersectionObserver API, the visibility observer allows
  // registration of one-off callbacks. If this option is set to true, the
  // callback will be only invoked once the observed element is intersecting
  // the viewport and it will only be invoked once. The callback will then be
  // automatically deregistered afterwards. Defaults to false.
  once: false,
})

function onVisibilityChange(
  // The observe function constrains the callback's parameter type to
  // IntersectionObserverEntry & {target: typeof elementToObserve}, which is
  // especially handy with in-line callbacks, removing the need to provide the
  // type annotation for the parameter in such case and providing additional
  // type safety if the observed element is referenced through the intersection
  // entry passed to the callback.
  visibilityEntry: IntersectionObserverEntry & {target: HTMLImageElement},
): void {
  if (visibilityEntry.isIntersecting) {
    visibilityEntry.target.src = imageSource

    // This is equivalent to setting the the once flag to true.
    unobserve(image, onVisibilityChange)
  }
}
```

The `observe()` function returns a convenience callback for deregistering the
provided callback from observing the specified element, allowing for a more
convenient use with anonymous functions as callbacks:

```typescript
const unobserveElement = observe(someElement, (visibilityEntry) => {
  if (/* some condition */) {
    unobserveElement()
  }
})
```
