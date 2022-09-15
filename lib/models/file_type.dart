// @dart=2.9

enum FileType {
  image,
  video,
  livePhoto,
  other,
}

int getInt(FileType fileType) {
  switch (fileType) {
    case FileType.image:
      return 0;
    case FileType.video:
      return 1;
    case FileType.livePhoto:
      return 2;
    default:
      return -1;
  }
}

FileType getFileType(int fileType) {
  switch (fileType) {
    case 0:
      return FileType.image;
    case 1:
      return FileType.video;
    case 2:
      return FileType.livePhoto;
    default:
      return FileType.other;
  }
}

String getHumanReadableString(FileType fileType) {
  switch (fileType) {
    case FileType.image:
      return "Image";
    case FileType.video:
      return "Video";
    case FileType.livePhoto:
      return "Live Photo";
    default:
      return fileType.name.toUpperCase();
  }
}
