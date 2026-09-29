"""Tests for scripts/compose.py.

Builds small, synthetic components/ trees under tmp_path rather than
exercising the real repo's components/ -- these tests need to construct
broken graphs (undeclared/dead/circular dependencies) on purpose, which
would otherwise mean corrupting real component data.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import compose  # noqa: E402


def write_component(components_dir, name, uses=None, template_src="<div></div>\n",
                     demo_src=None, style=True, script=True):
    """Scaffold components_dir/<name>/{meta.json,template.html,demo.html,
    style.css,component.js}. demo_src defaults to a plain include of this
    component's own template.html."""
    comp_dir = components_dir / name
    comp_dir.mkdir(parents=True, exist_ok=True)
    meta = {
        "name": name,
        "description": "test component",
        "status": "draft",
        "category": "buttons",
        "variants": [],
        "props": [],
        "source": "none",
        "rationale": "test",
        "themes_supported": ["light", "dark"],
    }
    if uses is not None:
        meta["uses"] = uses
    (comp_dir / "meta.json").write_text(json.dumps(meta))
    (comp_dir / "template.html").write_text(template_src)
    if demo_src is None:
        demo_src = f'{{% include "components/{name}/template.html" %}}\n'
    (comp_dir / "demo.html").write_text(demo_src)
    if style:
        (comp_dir / "style.css").write_text(f"/* {name} */\n")
    if script:
        (comp_dir / "component.js").write_text(f"/* {name} */\n")
    return comp_dir


@pytest.fixture
def components_root(tmp_path):
    root = tmp_path / "repo"
    (root / "components").mkdir(parents=True)
    return root


def test_undeclared_dependency_fails(components_root):
    components_dir = components_root / "components"
    write_component(components_dir, "child")
    write_component(
        components_dir, "parent",
        uses=[],  # doesn't declare "child" even though it includes it
        template_src='<div>{% include "components/child/template.html" %}</div>\n',
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert any("parent" in e and "child" in e and "does not list" in e for e in errors)


def test_dead_dependency_fails(components_root):
    components_dir = components_root / "components"
    write_component(components_dir, "child")
    write_component(
        components_dir, "parent",
        uses=["child"],  # declares it but never includes it
        template_src="<div>no include here</div>\n",
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert any("parent" in e and "child" in e and "never includes" in e for e in errors)


def test_circular_dependency_fails(components_root):
    components_dir = components_root / "components"
    write_component(
        components_dir, "a", uses=["b"],
        template_src='<div>{% include "components/b/template.html" %}</div>\n',
    )
    write_component(
        components_dir, "b", uses=["a"],
        template_src='<div>{% include "components/a/template.html" %}</div>\n',
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert not errors  # both sides' "uses" honestly match their real includes
    cycle = compose.find_cycle(graph)
    assert cycle is not None
    assert "a" in cycle and "b" in cycle


def test_deterministic_rerun(components_root):
    components_dir = components_root / "components"
    write_component(components_dir, "child")
    write_component(
        components_dir, "parent", uses=["child"],
        template_src='<div>{% include "components/child/template.html" %}</div>\n',
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert not errors
    assert compose.find_cycle(graph) is None

    compose.compose_default(env, components, graph)
    first = (components_dir / "parent" / "index.html").read_text()

    compose.compose_default(env, components, graph)
    second = (components_dir / "parent" / "index.html").read_text()

    assert first == second


def test_single_include_composition(components_root):
    components_dir = components_root / "components"
    write_component(
        components_dir, "child",
        template_src='<span class="child-marker">child content</span>\n',
    )
    write_component(
        components_dir, "parent", uses=["child"],
        template_src='<div class="parent">{% include "components/child/template.html" %}</div>\n',
        demo_src='{% include "components/parent/template.html" %}\n',
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert not errors

    compose.compose_default(env, components, graph)
    output = (components_dir / "parent" / "index.html").read_text()
    assert "child-marker" in output
    assert "child content" in output
    assert 'class="parent"' in output
    # transitive asset injection: child's style.css/component.js pulled in
    assert "../child/style.css" in output
    assert "../child/component.js" in output


def test_multi_variant_rendering(components_root):
    components_dir = components_root / "components"
    write_component(
        components_dir, "button",
        template_src=(
            "<button data-variant=\"{{ variant | default('primary') }}\">"
            "{{ label | default('Button') }}</button>\n"
        ),
        demo_src=(
            '{% with variant=\'primary\', label=\'Save\' %}'
            '{% include "components/button/template.html" %}{% endwith %}\n'
            '{% with variant=\'secondary\', label=\'Cancel\' %}'
            '{% include "components/button/template.html" %}{% endwith %}\n'
        ),
    )
    env = compose.make_env(root=components_root)
    components = compose.discover_components(components_dir)
    graph, errors = compose.build_and_validate_uses_graph(env, components)
    assert not errors

    compose.compose_default(env, components, graph)
    output = (components_dir / "button" / "index.html").read_text()
    assert 'data-variant="primary"' in output and ">Save<" in output
    assert 'data-variant="secondary"' in output and ">Cancel<" in output


def test_props_are_autoescaped():
    env = compose.make_env()
    out = env.from_string("<span>{{ label }}</span>").render(
        label="<img src=x onerror=alert(1)>"
    )
    assert out == "<span>&lt;img src=x onerror=alert(1)&gt;</span>"


def test_extra_attrs_marked_safe_pass_through():
    env = compose.make_env()
    out = env.from_string("<button{% if extra_attrs %} {{ extra_attrs | safe }}{% endif %}>").render(
        extra_attrs='data-popup-open="p1"'
    )
    assert out == '<button data-popup-open="p1">'


@pytest.mark.parametrize("url, expected", [
    ("#section", "#section"),
    ("../page.html", "../page.html"),
    ("https://example.org/?a=1", "https://example.org/?a=1"),
    ("mailto:a@example.org", "mailto:a@example.org"),
    ("javascript:alert(1)", "#"),
    ("  JaVaScRiPt:alert(1)", "#"),
    ("java\tscript:alert(1)", "#"),
    ("data:text/html,<script>alert(1)</script>", "#"),
    ("vbscript:msgbox(1)", "#"),
])
def test_safe_url(url, expected):
    assert compose.safe_url(url) == expected
