#!/usr/bin/env bash

null_object_id() {
	case "$(git rev-parse --show-object-format)" in
		sha1) printf '%040d\n' 0 ;;
		sha256) printf '%064d\n' 0 ;;
		*)
			echo "Error: unsupported Git object format." >&2
			exit 1
			;;
	esac
}
