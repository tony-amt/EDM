// Helper to convert API (camelCase) DTO to Model (snake_case)
const contactDtoToModel = (dto) => {
  const modelData = {};
  if (dto.email !== undefined) modelData.email = dto.email;
  if (dto.name !== undefined) modelData.name = dto.name;
  if (dto.phone !== undefined) modelData.phone = dto.phone;
  if (dto.company !== undefined) modelData.company = dto.company;
  if (dto.position !== undefined) modelData.position = dto.position;
  if (dto.username !== undefined) modelData.username = dto.username;
  if (dto.firstName !== undefined) modelData.first_name = dto.firstName;
  if (dto.lastName !== undefined) modelData.last_name = dto.lastName;
  if (dto.tikTokId !== undefined) modelData.tiktok_unique_id = dto.tikTokId;
  if (dto.insId !== undefined) modelData.instagram_id = dto.insId;
  if (dto.youtubeId !== undefined) modelData.youtube_id = dto.youtubeId;
  if (dto.status !== undefined) modelData.status = dto.status; // Assuming status is same in DTO and model
  if (dto.source !== undefined) modelData.source = dto.source;
  
  // Custom fields
  for (let i = 1; i <= 5; i++) {
    if (dto[`customField${i}`] !== undefined) {
      modelData[`custom_field_${i}`] = dto[`customField${i}`];
    }
  }
  return modelData;
}; 