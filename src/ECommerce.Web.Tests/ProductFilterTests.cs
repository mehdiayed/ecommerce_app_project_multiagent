using ECommerce.Web.Services;
using Xunit;

namespace ECommerce.Web.Tests;

public class ProductFilterTests
{
    private static List<ProductDto> Sample() =>
    [
        new(1, "Laptop", "Fast portable computer", 999m, 5),
        new(2, "Mouse", "Wireless LAPTOP accessory", 20m, 10),
        new(3, "Desk", null, 150m, 2),
        new(4, "100% Cotton <b> Shirt", "O'Neil edition", 30m, 7),
    ];

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NullEmptyWhitespace_ReturnsAll(string? term)
        => Assert.Equal(4, ProductFilter.Filter(Sample(), term).Count);

    [Theory]
    [InlineData("LAPTOP")]
    [InlineData("laptop")]
    [InlineData("LaPtOp")]
    public void CaseInsensitive(string term)
        => Assert.Equal([1, 2], ProductFilter.Filter(Sample(), term).Select(p => p.Id));

    [Fact]
    public void NameOnly_Mouse() => Assert.Equal([2], ProductFilter.Filter(Sample(), "mou").Select(p => p.Id));

    [Fact]
    public void DescriptionOnlyMatch() => Assert.Equal([1], ProductFilter.Filter(Sample(), "portable").Select(p => p.Id));

    [Fact]
    public void NullDescription_NoThrow_StillMatchesName()
        => Assert.Equal([3], ProductFilter.Filter(Sample(), "desk").Select(p => p.Id));

    [Fact]
    public void NullDescription_NoMatchOnDescription()
        => Assert.Empty(ProductFilter.Filter(Sample(), "zzz"));

    [Fact]
    public void TermIsTrimmed()
        => Assert.Equal([3], ProductFilter.Filter(Sample(), "  desk  ").Select(p => p.Id));

    [Fact]
    public void NoMatch_ReturnsEmpty() => Assert.Empty(ProductFilter.Filter(Sample(), "nonsense-xyz"));

    [Theory]
    [InlineData("%", 4)]
    [InlineData("<", 4)]
    [InlineData("'", 4)]
    [InlineData("<b>", 4)]
    [InlineData("[", -1)]
    [InlineData(".*", -1)]
    public void SpecialChars_LiteralNoThrow(string term, int id)
    {
        var r = ProductFilter.Filter(Sample(), term);
        if (id < 0) Assert.Empty(r); else Assert.Equal([id], r.Select(p => p.Id));
    }

    [Fact]
    public void VeryLongTerm_NoThrow()
        => Assert.Empty(ProductFilter.Filter(Sample(), new string('a', 100_000)));

    [Fact]
    public void InputNotMutated()
    {
        var list = Sample();
        var copy = list.ToList();
        _ = ProductFilter.Filter(list, "laptop");
        _ = ProductFilter.Filter(list, "");
        Assert.Equal(copy, list);
    }
}
