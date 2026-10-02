import { faculties } from "../src/data/faculty";
import { hostelGroups } from "../src/data/hostels";
import { facultyPhotoKey } from "../src/utils/faculty-photo-cache";

const wardens = hostelGroups.find((hostel) => hostel.id === "manimala");
if (!wardens) throw new Error("Default hostel missing");
const byId = new Map(faculties.map((faculty) => [faculty.id, faculty]));
const files = wardens.wardenIds.map((id) => {
  const url = byId.get(id)?.imageUrl;
  if (!url) throw new Error(`Default warden photo missing: ${id}`);
  return `${facultyPhotoKey(url)}.img`;
});
console.log(JSON.stringify(files));
