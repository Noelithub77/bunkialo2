import { requireOptionalNativeModule } from "expo-modules-core";

export interface WearTimetableModule {
  isAvailable(): Promise<boolean>;
  sendTimetable(payload: string): Promise<void>;
}

const WearTimetable = requireOptionalNativeModule<WearTimetableModule>(
  "WearTimetable",
);

export default WearTimetable;
