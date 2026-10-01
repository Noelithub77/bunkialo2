import { requireOptionalNativeModule } from "expo-modules-core";

export default requireOptionalNativeModule<{
  setSchedule(boundaries: number[]): Promise<void>;
}>("WidgetRefresh");
