#!/bin/sh
APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
JAVA=${JAVA_HOME:+$JAVA_HOME/bin/}java
if [ ! -f "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" ]; then
  echo "Missing Gradle Wrapper JAR. Download the official Gradle 8.10.2 wrapper JAR and verify SHA-256." >&2
  exit 1
fi
exec "$JAVA" -Xmx64m -Xms64m -Dorg.gradle.appname=gradlew -cp "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain "$@"
