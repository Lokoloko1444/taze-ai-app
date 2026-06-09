import { Platform } from 'react-native';

import { DemoExperiencePage } from 'components/demo-experience-page';
import { PublicWebsitePage } from 'components/public-website-page';
import { RoleHome } from 'components/role-home';
import { getHostSurface } from 'lib/domain-config';

export default function HomeScreen() {
  const hostSurface =
    Platform.OS === 'web' && typeof window !== 'undefined' ? getHostSurface(window.location.hostname) : 'app';

  if (hostSurface === 'public') {
    return <PublicWebsitePage />;
  }

  if (hostSurface === 'demo') {
    return <DemoExperiencePage />;
  }

  return <RoleHome />;
}
