import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingNavigations = [];

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    console.log('[RootNavigation] Navigation ref not ready. Queuing navigation to:', name);
    pendingNavigations.push({ name, params });
  }
}

export function resetTo(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name, params }],
      })
    );
  } else {
    pendingNavigations = [{ type: 'reset', name, params }];
  }
}

export function flushPendingNavigation() {
  if (navigationRef.isReady() && pendingNavigations.length > 0) {
    console.log('[RootNavigation] Flushing pending navigations count:', pendingNavigations.length);
    while (pendingNavigations.length > 0) {
      const nav = pendingNavigations.shift();
      if (nav.type === 'reset') {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: nav.name, params: nav.params }],
          })
        );
      } else {
        navigationRef.navigate(nav.name, nav.params);
      }
    }
  }
}
