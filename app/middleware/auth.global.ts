import { normalizeRoutePath } from "../../shared/domain";
export default defineNuxtRouteMiddleware(async (to) => {
  const path = normalizeRoutePath(to.path);
  if (["/", "/login", "/auth/callback"].includes(path)) return;
  const { account, load } = useAccount();
  if (!account.value) {
    try {
      await load();
    } catch {
      return navigateTo("/login");
    }
  }
  if (!account.value?.workspace && path !== "/onboarding")
    return navigateTo("/onboarding");
  if (account.value?.workspace && path === "/onboarding")
    return navigateTo("/dashboard");
});
