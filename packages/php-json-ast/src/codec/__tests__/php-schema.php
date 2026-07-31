<?php

declare(strict_types=1);

$packageRoot = dirname(__DIR__, 3);
$autoloadPath = $packageRoot . '/vendor/autoload.php';
$nodeDirectory = $packageRoot . '/vendor/nikic/php-parser/lib/PhpParser/Node';

if (!is_file($autoloadPath)) {
    fwrite(STDERR, "Missing required Composer autoload asset: {$autoloadPath}\n");
    exit(2);
}
if (!is_dir($nodeDirectory)) {
    fwrite(STDERR, "Missing required PhpParser schema directory: {$nodeDirectory}\n");
    exit(2);
}

require $autoloadPath;

use Composer\InstalledVersions;
use PhpParser\NodeAbstract;

$input = stream_get_contents(STDIN);
if ($input === false) {
    fwrite(STDERR, "Failed to read requested node types from STDIN.\n");
    exit(1);
}

try {
    $requestedNodeTypes = json_decode($input, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($requestedNodeTypes) || !array_is_list($requestedNodeTypes)) {
        throw new RuntimeException('Expected a JSON list of node types.');
    }

    $requested = [];
    foreach ($requestedNodeTypes as $nodeType) {
        if (!is_string($nodeType) || $nodeType === '') {
            throw new RuntimeException('Node types must be non-empty strings.');
        }
        $requested[$nodeType] = true;
    }

    $classToNodeType = [];
    $nodes = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($nodeDirectory)
    );

    /** @var SplFileInfo $file */
    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }

        $relative = substr($file->getPathname(), strlen($nodeDirectory) + 1);
        $class = 'PhpParser\\Node\\' . str_replace(
            DIRECTORY_SEPARATOR,
            '\\',
            substr($relative, 0, -4)
        );
        if (!class_exists($class)) {
            continue;
        }

        $reflection = new ReflectionClass($class);
        if (
            !$reflection->isSubclassOf(NodeAbstract::class) ||
            $reflection->isAbstract()
        ) {
            continue;
        }

        $instance = $reflection->newInstanceWithoutConstructor();
        $nodeType = $instance->getType();
        if (!is_string($nodeType) || $nodeType === '') {
            continue;
        }

        $classToNodeType[$class] = $nodeType;
        if (!isset($requested[$nodeType])) {
            continue;
        }

        $properties = [];
        foreach ($instance->getSubNodeNames() as $propertyName) {
            if (!is_string($propertyName) || !$reflection->hasProperty($propertyName)) {
                throw new RuntimeException(
                    "{$class} declares an unreflectable subnode {$propertyName}."
                );
            }

            $property = $reflection->getProperty($propertyName);
            $properties[$propertyName] = [
                'docType' => extractVarType($property->getDocComment() ?: ''),
                'reflectionType' => $property->getType()?->__toString(),
            ];
        }

        ksort($properties);
        $nodes[$nodeType] = [
            'class' => $class,
            'properties' => $properties,
        ];
    }

    ksort($classToNodeType);
    ksort($nodes);

    $version = InstalledVersions::getPrettyVersion('nikic/php-parser');
    if (!is_string($version) || $version === '') {
        throw new RuntimeException('Unable to resolve installed nikic/php-parser version.');
    }

    echo json_encode(
        [
            'phpParserVersion' => $version,
            'classToNodeType' => $classToNodeType,
            'nodes' => $nodes,
        ],
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES
    ) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Schema extraction failure: ' . $error->getMessage() . "\n");
    exit(1);
}

function extractVarType(string $docComment): ?string
{
    if (preg_match('/@var\s+([^\s*]+)/', $docComment, $matches) !== 1) {
        return null;
    }

    return $matches[1];
}
