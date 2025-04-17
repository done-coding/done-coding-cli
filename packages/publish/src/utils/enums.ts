/**
 * 发布版本类型
 */
export enum PublishVersionTypeEnum {
  /**
   * 主版本号
   */
  MAJOR = "major",
  /**
   * 次版本号
   */
  MINOR = "minor",
  /**
   * 修订版本号
   */
  PATCH = "patch",
  /**
   * 预发布版本号
   */
  PREMAJOR = "premajor",
  /**
   * 预发布次版本号
   */
  PREMINOR = "preminor",
  /**
   * 预发布修订版本号
   */
  PREPATCH = "prepatch",
  /**
   * 预发布版本号
   */
  PRERELEASE = "prerelease",
}

/**
 * 发布标签类型
 */
export enum PublishTagEnum {
  /**
   * 最新版本
   */
  LATEST = "latest",
  /**
   * next版本
   */
  NEXT = "next",
  /**
   * alpha版本
   */
  ALPHA = "alpha",
}
