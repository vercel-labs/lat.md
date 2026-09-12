<?php
namespace App {
    const TOP = 1;
    function helper() {}
    interface Contract { public function run(): void; }
    trait Logs { protected function log(): void {} }
    enum Status: string { case Ready = 'ready'; }
    class Example implements Contract {
        use Logs;
        public const VERSION = 1;
        protected string $value;
        public function __construct(public $id, private string &$reference) {}
        public function run(): void {}
    }
    if (!function_exists('fallback')) { function fallback() {} }
}
namespace { function globalHelper() {} }
