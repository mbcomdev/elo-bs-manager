# ELO BS Manager Plugin

This Gradle plugin is designed to download and install ELO Business Solutions.

## Disclaimer

This software is developed by MBCOM IT-Systemhaus GmbH.
This software is not a product of ELO Digital Office GmbH. Thus, ELO Digital Office GmbH will not support this software!
Support can be found creating an issue at GitHub: https://github.com/mbcomdev/elo-bs-manager/issues


## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tasks](#tasks)
- [License](#license)

## Installation

To use the ELO BS Manager Plugin, add the following to your `build.gradle` file:

```groovy
plugins {
    id 'de.mbcom.elo-bs-manager' version '1.0.0'
}
```

## Usage

Apply the plugin in your build.gradle file:

```groovy
apply plugin: 'de.mbcom.elo-bs-manager'
```

## Configuration

Configure the plugin by adding the elobsmanager extension to your build.gradle file:

```groovy
elobsmanager {
    bsUrls = ['https://example.com/path/to/bs1.eloinst', 'https://example.com/path/to/bs2.eloinst']
}
```

### Required properties

The following properties must be set in your gradle.properties file:

```properties
elo.server.ixUrl=https://elo-server.example.com/ix-repository/ix
elo.server.username=your-username
elo.server.password=your-password
```

## Tasks   

The plugin provides the following tasks:

    - setupBusinessSolutions: Downloads and installs the specified business solutions.

Run the task using the following command:

```bash
./gradlew setupBusinessSolutions
```

## License

This project is licensed under the MIT License. See the LICENSE file for details