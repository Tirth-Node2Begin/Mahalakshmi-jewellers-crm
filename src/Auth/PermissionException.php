<?php

declare(strict_types=1);

namespace CRM\Auth;

/** Missing permission → 403 FORBIDDEN. */
final class PermissionException extends \RuntimeException
{
}
