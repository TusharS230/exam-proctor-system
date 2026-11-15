# Stage 1: build the jar with Maven
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# download dependencies first, so Docker can cache them between builds
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: run the jar on a small Java runtime image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# run as a normal user instead of root
RUN useradd --system --create-home appuser
USER appuser

COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
