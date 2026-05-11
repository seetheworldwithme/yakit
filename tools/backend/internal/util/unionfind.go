package util

// UnionFind implements a disjoint-set (Union-Find) data structure with
// path compression and union by rank.
type UnionFind struct {
	parent []int
	rank   []int
	count  int // number of distinct sets
}

// NewUnionFind creates a Union-Find with n elements (0..n-1), each in its own set.
func NewUnionFind(n int) *UnionFind {
	p := make([]int, n)
	r := make([]int, n)
	for i := range p {
		p[i] = i
	}
	return &UnionFind{parent: p, rank: r, count: n}
}

// Find returns the root representative of the set containing x, with path compression.
func (uf *UnionFind) Find(x int) int {
	if uf.parent[x] != x {
		uf.parent[x] = uf.Find(uf.parent[x])
	}
	return uf.parent[x]
}

// Union merges the sets containing x and y. Returns true if they were in different sets.
func (uf *UnionFind) Union(x, y int) bool {
	rx, ry := uf.Find(x), uf.Find(y)
	if rx == ry {
		return false
	}
	if uf.rank[rx] < uf.rank[ry] {
		rx, ry = ry, rx
	}
	uf.parent[ry] = rx
	if uf.rank[rx] == uf.rank[ry] {
		uf.rank[rx]++
	}
	uf.count--
	return true
}

// Count returns the number of distinct sets.
func (uf *UnionFind) Count() int {
	return uf.count
}

// ComponentID returns the root ID of the set containing x.
func (uf *UnionFind) ComponentID(x int) int {
	return uf.Find(x)
}
